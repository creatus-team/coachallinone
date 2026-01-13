import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { addDays, nextDay, format, addWeeks } from 'date-fns';

// 요일 문자열 -> date-fns Day index (0=일, 1=월, ...)
const DAY_MAP: Record<string, 0 | 1 | 2 | 3 | 4 | 5 | 6> = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
};

// 다음 주의 특정 요일 찾기 (이번 주 해당 요일이어도 다음 주로)
function getNextWeekDay(fromDate: Date, dayOfWeek: string): Date {
    const dayIndex = DAY_MAP[dayOfWeek];
    if (dayIndex === undefined) return addDays(fromDate, 7);

    // nextDay는 다음 해당 요일을 찾음 (오늘이면 다음주)
    const nextOccurrence = nextDay(fromDate, dayIndex);

    // 만약 다음 발생이 7일 이내면 그 다음 주로
    const daysDiff = Math.ceil((nextOccurrence.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) {
        return addWeeks(nextOccurrence, 1);
    }
    return nextOccurrence;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        console.log('[Rapid Webhook] Received:', JSON.stringify(body, null, 2));

        // 래피드 웹훅 데이터 파싱
        const { event_type, order } = body;

        // 취소 이벤트 처리
        if (event_type === 'order.cancelled' || event_type === 'order.refunded') {
            return handleCancellation(order);
        }

        // 결제 완료 이벤트만 처리
        if (event_type !== 'order.completed') {
            return NextResponse.json({ message: 'Event ignored', event_type });
        }

        const customerName = order?.customer?.name || '고객';
        const customerPhone = order?.customer?.phone || '';
        const productName = order?.product?.name || '';
        const amount = order?.amount || 0;

        // 상품명으로 신규/재결제 구분
        const isRenewal = productName.includes('재결제') || productName.includes('연장');

        if (isRenewal) {
            return handleRenewal(customerName, customerPhone, productName, amount);
        } else {
            return handleNewEnrollment(customerName, customerPhone, productName, amount);
        }

    } catch (error: any) {
        console.error('[Rapid Webhook Error]', error);

        // 관리자 알림
        await sendSMS({
            to: process.env.ADMIN_PHONE!,
            text: `[시스템오류] Rapid 웹훅 처리 실패\n${error.message}`,
            type: 'ADMIN',
            recipientName: '관리자'
        });

        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ========== 신규 등록 처리 ==========
async function handleNewEnrollment(name: string, phone: string, product: string, amount: number) {
    console.log('[New Enrollment]', { name, phone, product, amount });

    // 1. 사용 가능한 슬롯 찾기 (가장 여유 있는 코치)
    const slotRes = await query(`
        SELECT cs.*, c.name as coach_name, c.phone as coach_phone
        FROM coach_slots cs
        JOIN coaches c ON cs.coach_id = c.id
        WHERE cs.is_available = true AND cs.assigned_user_id IS NULL
        ORDER BY (
            SELECT COUNT(*) FROM coach_slots 
            WHERE coach_id = cs.coach_id AND is_available = true
        ) DESC
        LIMIT 1
    `);

    if (slotRes.rows.length === 0) {
        // 슬롯 없음 - 관리자에게 알림
        await sendSMS({
            to: process.env.ADMIN_PHONE!,
            text: `[긴급] 신규 결제 but 슬롯 없음!\n${name} (${phone})\n상품: ${product}`,
            type: 'ADMIN',
            recipientName: '관리자'
        });
        return NextResponse.json({ error: 'No available slots', handled: false });
    }

    const slot = slotRes.rows[0];

    // 2. 첫 수업일 계산 (결제 다음 주의 해당 요일)
    const today = new Date();
    const firstSessionDate = getNextWeekDay(today, slot.day_of_week);
    const sessionEndDate = addWeeks(firstSessionDate, 3); // 4회차 포함 (0,1,2,3주)

    // 3. 유저 생성/업데이트
    const userRes = await query(`
        INSERT INTO users (name, phone, status, product_type)
        VALUES ($1, $2, 'pending', $3)
        ON CONFLICT (phone) DO UPDATE SET
            name = EXCLUDED.name,
            status = 'pending',
            product_type = EXCLUDED.product_type
        RETURNING id
    `, [name, phone, product]);
    const userId = userRes.rows[0].id;

    // 4. 세션 생성
    await query(`
        INSERT INTO sessions (user_id, coach_id, day_of_week, start_time, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, slot.coach_id, slot.day_of_week, slot.start_time, firstSessionDate, sessionEndDate]);

    // 5. 슬롯 배정 처리
    await query(`
        UPDATE coach_slots SET 
            is_available = false, 
            assigned_user_id = $1 
        WHERE id = $2
    `, [userId, slot.id]);

    // 6. 문자 발송 (관리자에게)
    const startDateStr = format(firstSessionDate, 'M/d(EEE)');
    const endDateStr = format(sessionEndDate, 'M/d(EEE)');

    await sendSMS({
        to: process.env.ADMIN_PHONE!,
        text: `[신규결제] ${name}\n담당: ${slot.coach_name}\n수업: ${slot.day_of_week} ${slot.start_time}\n기간: ${startDateStr} ~ ${endDateStr}`,
        type: 'NEW',
        recipientName: '관리자'
    });

    console.log('[New Enrollment Complete]', {
        user: name,
        coach: slot.coach_name,
        slot: `${slot.day_of_week} ${slot.start_time}`,
        period: `${startDateStr} ~ ${endDateStr}`
    });

    return NextResponse.json({
        success: true,
        type: 'new_enrollment',
        user: name,
        coach: slot.coach_name,
        firstSession: startDateStr,
        endDate: endDateStr
    });
}

// ========== 재결제 처리 ==========
async function handleRenewal(name: string, phone: string, product: string, amount: number) {
    console.log('[Renewal]', { name, phone, product, amount });

    // 1. 기존 유저와 세션 찾기
    const userRes = await query(`SELECT id FROM users WHERE phone = $1`, [phone]);

    if (userRes.rows.length === 0) {
        // 유저 없음 - 신규로 처리
        return handleNewEnrollment(name, phone, product, amount);
    }

    const userId = userRes.rows[0].id;

    // 2. 현재 세션 찾기
    const sessionRes = await query(`
        SELECT s.*, c.name as coach_name 
        FROM sessions s
        JOIN coaches c ON s.coach_id = c.id
        WHERE s.user_id = $1
        ORDER BY s.end_date DESC
        LIMIT 1
    `, [userId]);

    if (sessionRes.rows.length === 0) {
        return handleNewEnrollment(name, phone, product, amount);
    }

    const currentSession = sessionRes.rows[0];

    // 3. 새 종료일 계산 (기존 종료일 + 4주)
    const currentEndDate = new Date(currentSession.end_date);
    const newEndDate = addWeeks(currentEndDate, 4);

    // 4. 세션 연장
    await query(`
        UPDATE sessions SET end_date = $1 WHERE id = $2
    `, [newEndDate, currentSession.id]);

    // 5. 문자 발송
    const endDateStr = format(newEndDate, 'M/d(EEE)');

    await sendSMS({
        to: process.env.ADMIN_PHONE!,
        text: `[재결제] ${name}\n담당: ${currentSession.coach_name}\n연장 종료일: ${endDateStr}`,
        type: 'RENEWAL',
        recipientName: '관리자'
    });

    console.log('[Renewal Complete]', {
        user: name,
        coach: currentSession.coach_name,
        newEndDate: endDateStr
    });

    return NextResponse.json({
        success: true,
        type: 'renewal',
        user: name,
        coach: currentSession.coach_name,
        newEndDate: endDateStr
    });
}

// ========== 취소 처리 ==========
async function handleCancellation(order: any) {
    const customerName = order?.customer?.name || '고객';
    const customerPhone = order?.customer?.phone || '';
    const amount = order?.amount || 0;

    console.log('[Cancellation]', { customerName, customerPhone, amount });

    // 1. 유저 찾기
    const userRes = await query(`SELECT id FROM users WHERE phone = $1`, [customerPhone]);

    if (userRes.rows.length === 0) {
        return NextResponse.json({ message: 'User not found for cancellation' });
    }

    const userId = userRes.rows[0].id;

    // 2. 취소 로그 기록 (나중에 관리자가 처리)
    await query(`
        INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
        VALUES ('CANCEL_REQUEST', $1, $2, $3, 'PENDING')
    `, [customerName, customerPhone, `환불 요청: ₩${amount.toLocaleString()}`]);

    // 3. 관리자 알림
    await sendSMS({
        to: process.env.ADMIN_PHONE!,
        text: `[취소요청] ${customerName}\n${customerPhone}\n환불액: ₩${amount.toLocaleString()}\n\n관리자 페이지에서 매칭 취소 처리 필요`,
        type: 'ADMIN',
        recipientName: '관리자'
    });

    return NextResponse.json({
        success: true,
        type: 'cancellation_logged',
        user: customerName,
        amount
    });
}
