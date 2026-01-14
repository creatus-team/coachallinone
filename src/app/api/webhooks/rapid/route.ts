import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { addWeeks, nextDay, format } from 'date-fns';

// 요일 문자열 -> date-fns Day index
const DAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6
};

// 다음 주의 특정 요일 찾기 (결제일 다음 주)
function getNextWeekDay(fromDate: Date, dayOfWeek: string): Date {
    const dayIndex = DAY_MAP[dayOfWeek];
    if (dayIndex === undefined) return addWeeks(fromDate, 1);

    // 현재 주의 다음 주로 이동
    const nextWeekStart = new Date(fromDate);
    nextWeekStart.setDate(fromDate.getDate() + (7 - fromDate.getDay()) + 1); // 다음 주 월요일

    // 해당 요일로 이동
    const targetDayOffset = dayIndex === 0 ? 6 : dayIndex - 1; // 월요일 기준
    const targetDate = new Date(nextWeekStart);
    targetDate.setDate(nextWeekStart.getDate() + targetDayOffset);

    return targetDate;
}

// 구매옵션 파싱: "홍성준/월요일/21:00~21:40" -> { coach, day, time }
function parseOption(optionStr: string): { coach: string; day: string; time: string } | null {
    if (!optionStr || optionStr === '재결제') return null;

    const parts = optionStr.split('/');

    // 새 형식: "홍성준/월요일/21:00~21:40" (3파트)
    // 기존 형식: "홍성준/매주/월요일/21:00~21:40" (4파트) - 하위호환
    if (parts.length === 3) {
        const coach = parts[0].trim();
        const day = parts[1].trim(); // 월요일, 화요일 등
        const timeRange = parts[2].trim(); // 21:00~21:40
        const time = timeRange.split('~')[0]; // 시작 시간만
        return { coach, day, time };
    } else if (parts.length >= 4) {
        // 기존 형식 하위호환
        const coach = parts[0].trim();
        const day = parts[2].trim();
        const timeRange = parts[3].trim();
        const time = timeRange.split('~')[0];
        return { coach, day, time };
    }

    return null;
}

// 전화번호 정규화
function normalizePhone(phone: string): string {
    if (!phone) return '';
    let str = phone.replace(/[^0-9]/g, '');
    if (str.startsWith('82') && str.length > 10) str = '0' + str.slice(2);
    if (str.startsWith('10') && str.length === 10) str = '0' + str;
    return str;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('[Rapid Webhook] Received:', JSON.stringify(body, null, 2));

        // 래피드 실제 API 형식
        const payment = body.payment || {};
        const customerName = payment.name || '';
        const customerPhone = normalizePhone(payment.phoneNumber || '');
        const purchaseOption = payment.option || '';
        const status = payment.status || ''; // "SUCCESS" or "CANCEL"
        const amount = payment.amount || 0;
        const cancelReason = payment.canceledReason || '';

        // 결제 취소인 경우
        if (status === 'CANCEL') {
            return handleCancellation(customerName, customerPhone, amount, cancelReason);
        }

        // 결제 성공이 아니면 무시
        if (status !== 'SUCCESS') {
            return NextResponse.json({ message: 'Status ignored', status });
        }

        // 재결제 vs 신규 분기
        if (purchaseOption === '재결제' || purchaseOption.includes('재결제')) {
            return handleRenewal(customerName, customerPhone, amount);
        } else {
            return handleNewEnrollment(customerName, customerPhone, purchaseOption, amount);
        }


    } catch (error: any) {
        console.error('[Rapid Webhook Error]', error);

        // 오류는 SYSTEM_ALERT 로그에 기록 (SMS 대신)
        await query(`
            INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
            VALUES ('SYSTEM_ALERT', '시스템', '', $1, 'PENDING')
        `, [`[웹훅오류] Rapid 웹훅 처리 실패\n${error.message}`]);

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ========== 신규 등록 처리 ==========
async function handleNewEnrollment(name: string, phone: string, option: string, amount: number) {
    console.log('[New Enrollment]', { name, phone, option, amount });

    // 0-1. 멱등성 체크 (같은 전화번호로 오늘 이미 처리됐으면 무시)
    const todayStr = new Date().toISOString().split('T')[0];
    const duplicateCheck = await query(`
        SELECT id FROM message_logs 
        WHERE recipient_phone = $1 
          AND type = 'NEW' 
          AND DATE(sent_at) = $2
        LIMIT 1
    `, [phone, todayStr]);

    if (duplicateCheck.rows.length > 0) {
        console.log('[Duplicate Webhook Ignored]', { phone, date: todayStr });
        return NextResponse.json({
            success: true,
            message: 'Duplicate webhook ignored',
            alreadyProcessedToday: true
        });
    }

    // 0-2. 활성 세션 체크 (이미 진행 중인 세션이 있으면 관리자 알림)
    const activeSessionCheck = await query(`
        SELECT s.id, s.day_of_week, s.start_time, c.name as coach_name
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        JOIN coaches c ON s.coach_id = c.id
        WHERE u.phone = $1 AND s.end_date >= CURRENT_DATE
    `, [phone]);

    if (activeSessionCheck.rows.length > 0) {
        const existing = activeSessionCheck.rows[0];

        // 관리자 알림 로그 기록 (SYSTEM_ALERT 타입)
        await query(`
            INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
            VALUES ('SYSTEM_ALERT', $1, $2, $3, 'PENDING')
        `, [name, phone, `[중복결제] 활성 세션 있는 고객이 신규 결제!\n기존: ${existing.coach_name} ${existing.day_of_week} ${existing.start_time}\n신규옵션: ${option}\n⚠️ 수동 처리 필요`]);

        await sendSMS({
            to: process.env.ADMIN_PHONE!,
            text: `[중복결제 주의]\n${name} (${phone})\n\n기존 세션 있는데 신규 결제함!\n기존: ${existing.coach_name} ${existing.day_of_week} ${existing.start_time}\n신규: ${option}\n\n관리자 페이지에서 확인 필요`,
            type: 'ADMIN',
            recipientName: '관리자'
        });

        return NextResponse.json({
            error: 'Active session exists',
            existingSession: `${existing.coach_name} ${existing.day_of_week} ${existing.start_time}`,
            requiresManualHandling: true
        });
    }

    // 1. 옵션 파싱
    const parsed = parseOption(option);
    if (!parsed) {
        // 관리자 알림 로그
        await query(`
            INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
            VALUES ('SYSTEM_ALERT', $1, $2, $3, 'PENDING')
        `, [name, phone, `[파싱오류] 옵션: ${option}`]);

        await sendSMS({
            to: process.env.ADMIN_PHONE!,
            text: `[오류] 옵션 파싱 실패\n${name} (${phone})\n옵션: ${option}`,
            type: 'ADMIN',
            recipientName: '관리자'
        });
        return NextResponse.json({ error: 'Option parsing failed', option });
    }

    // 2. 코치 찾기
    const coachRes = await query(`SELECT id, name, phone FROM coaches WHERE name = $1`, [parsed.coach]);
    if (coachRes.rows.length === 0) {
        await sendSMS({
            to: process.env.ADMIN_PHONE!,
            text: `[오류] 코치 없음: ${parsed.coach}\n${name} (${phone})`,
            type: 'ADMIN',
            recipientName: '관리자'
        });
        return NextResponse.json({ error: 'Coach not found', coach: parsed.coach });
    }
    const coach = coachRes.rows[0];

    // 3. 슬롯 찾기 (해당 코치의 해당 요일/시간)
    const slotRes = await query(`
        SELECT * FROM coach_slots 
        WHERE coach_id = $1 AND day_of_week = $2 AND start_time = $3
    `, [coach.id, parsed.day, parsed.time]);

    if (slotRes.rows.length === 0) {
        // 슬롯이 없으면 자동 생성
        await query(`
            INSERT INTO coach_slots (coach_id, day_of_week, start_time, is_available)
            VALUES ($1, $2, $3, false)
        `, [coach.id, parsed.day, parsed.time]);
    } else if (!slotRes.rows[0].is_available) {
        // 슬롯이 이미 배정됨
        await sendSMS({
            to: process.env.ADMIN_PHONE!,
            text: `[경고] 슬롯 중복!\n${parsed.coach} ${parsed.day} ${parsed.time}\n신규: ${name}`,
            type: 'ADMIN',
            recipientName: '관리자'
        });
    }

    // 4. 첫 수업일 계산 (결제 다음 주의 해당 요일)
    const today = new Date();
    const firstSessionDate = getNextWeekDay(today, parsed.day);
    const sessionEndDate = addWeeks(firstSessionDate, 3); // 4회차 포함

    // 5. 유저 생성/업데이트
    const userRes = await query(`
        INSERT INTO users (name, phone, status, product_type)
        VALUES ($1, $2, 'pending', $3)
        ON CONFLICT (phone) DO UPDATE SET
            name = EXCLUDED.name,
            status = 'pending',
            product_type = EXCLUDED.product_type
        RETURNING id
    `, [name, phone, option]);
    const userId = userRes.rows[0].id;

    // 6. 세션 생성
    await query(`
        INSERT INTO sessions (user_id, coach_id, day_of_week, start_time, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, coach.id, parsed.day, parsed.time, firstSessionDate, sessionEndDate]);

    // 7. 슬롯 배정
    await query(`
        UPDATE coach_slots SET is_available = false, assigned_user_id = $1 
        WHERE coach_id = $2 AND day_of_week = $3 AND start_time = $4
    `, [userId, coach.id, parsed.day, parsed.time]);

    // 8. 로그 (정상 결제는 알림 불필요 - 자동 처리됨)
    const startDateStr = format(firstSessionDate, 'M/d(EEE)');
    const endDateStr = format(sessionEndDate, 'M/d(EEE)');

    console.log('[New Enrollment Complete]', { user: name, coach: parsed.coach, slot: `${parsed.day} ${parsed.time}`, period: `${startDateStr}~${endDateStr}` });

    return NextResponse.json({
        success: true,
        type: 'new_enrollment',
        user: name,
        coach: parsed.coach,
        slot: `${parsed.day} ${parsed.time}`,
        firstSession: startDateStr
    });
}

// ========== 재결제 처리 ==========
async function handleRenewal(name: string, phone: string, amount: number) {
    console.log('[Renewal]', { name, phone, amount });

    // 1. 기존 유저 찾기
    const userRes = await query(`SELECT id FROM users WHERE phone = $1`, [phone]);

    if (userRes.rows.length === 0) {
        await sendSMS({
            to: process.env.ADMIN_PHONE!,
            text: `[오류] 재결제인데 기존 유저 없음!\n${name} (${phone})`,
            type: 'ADMIN',
            recipientName: '관리자'
        });
        return NextResponse.json({ error: 'User not found for renewal', phone });
    }

    const userId = userRes.rows[0].id;

    // 2. 기존 세션 찾기 (가장 최근)
    const sessionRes = await query(`
        SELECT s.*, c.name as coach_name 
        FROM sessions s
        JOIN coaches c ON s.coach_id = c.id
        WHERE s.user_id = $1
        ORDER BY s.end_date DESC
        LIMIT 1
    `, [userId]);

    if (sessionRes.rows.length === 0) {
        await sendSMS({
            to: process.env.ADMIN_PHONE!,
            text: `[오류] 재결제인데 기존 세션 없음!\n${name} (${phone})`,
            type: 'ADMIN',
            recipientName: '관리자'
        });
        return NextResponse.json({ error: 'No existing session for renewal', phone });
    }

    const session = sessionRes.rows[0];

    // 3. 종료일 연장 (+4주)
    const currentEndDate = new Date(session.end_date);
    const newEndDate = addWeeks(currentEndDate, 4);

    await query(`UPDATE sessions SET end_date = $1 WHERE id = $2`, [newEndDate, session.id]);

    // 4. 유저 상태 업데이트
    await query(`UPDATE users SET status = 'active' WHERE id = $1`, [userId]);

    // 5. 로그 (정상 재결제는 알림 불필요)
    const endDateStr = format(newEndDate, 'M/d(EEE)');

    console.log('[Renewal Complete]', { user: name, coach: session.coach_name, newEndDate: endDateStr });

    return NextResponse.json({
        success: true,
        type: 'renewal',
        user: name,
        coach: session.coach_name,
        newEndDate: endDateStr
    });
}

// ========== 취소 처리 ==========
async function handleCancellation(name: string, phone: string, amount: number, cancelReason: string) {
    console.log('[Cancellation Request]', { name, phone, amount, cancelReason });

    // 취소 요청 로그 기록 (관리자가 처리)
    await query(`
        INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
        VALUES ('CANCEL_REQUEST', $1, $2, $3, 'PENDING')
    `, [name, phone, `환불 요청: ₩${amount.toLocaleString()}${cancelReason ? ` | 사유: ${cancelReason}` : ''}`]);

    await sendSMS({
        to: process.env.ADMIN_PHONE!,
        text: `[취소요청] ${name}\n${phone}\n환불액: ₩${amount.toLocaleString()}${cancelReason ? `\n사유: ${cancelReason}` : ''}\n\n관리자 페이지에서 처리 필요`,
        type: 'ADMIN',
        recipientName: '관리자'
    });

    return NextResponse.json({ success: true, type: 'cancellation_logged', user: name });
}
