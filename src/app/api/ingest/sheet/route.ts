import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * 📥 Sheet Ingest API (무조건 수용 버전)
 * 원칙: 일단 다 받고, 나중에 분류한다.
 * - 모든 데이터 무조건 저장
 * - 처리 시도 후 실패해도 저장 유지
 * - 실패 시 'NEEDS_ATTENTION' 상태로 관리자 알림
 */

export async function POST(request: Request) {
    // 1. 보안 인증
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.CRITUS_API_KEY && apiKey !== 'critus-secret-key-2026') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('[Sheet Ingest] Received:', body);

    // 2. 무조건 저장 (이게 핵심!)
    let rawId: number;
    try {
        const insertRes = await query(`
            INSERT INTO raw_webhooks (source, payload, status)
            VALUES ($1, $2, 'RECEIVED')
            RETURNING id
        `, ['google_sheet', body]);

        rawId = insertRes.rows[0].id;
        console.log(`[Sheet Ingest] Saved as raw_webhook #${rawId}`);
    } catch (dbError) {
        console.error('[Sheet Ingest] DB Save Error:', dbError);
        return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }

    // 3. 여기서 무조건 SUCCESS 응답! (엑셀은 성공으로 표시됨)
    // 처리는 비동기로 시도하되, 실패해도 엑셀엔 영향 없음

    // 비동기 처리 시도 (응답 후 실행)
    processInBackground(rawId, body).catch(err => {
        console.error(`[Sheet Ingest] Background processing failed for #${rawId}:`, err);
    });

    return NextResponse.json({ success: true, rawId, message: '데이터 수신 완료' });
}

// --- 백그라운드 처리 ---
async function processInBackground(rawId: number, body: any) {
    const { name, phone, option } = body;

    try {
        // 분류 로직
        // 0. 취소/실패 건 필터링 (강력한 방어)
        const allValues = Object.values(body).join(' ');
        if (allValues.includes('취소') || allValues.includes('실패') || allValues.includes('환불')) {
            console.log(`[Sheet Ingest] Skipped due to negative status: ${name} (${phone})`);
            await query(`UPDATE raw_webhooks SET status = 'SKIPPED', error_log = '취소/실패/환불 건으로 스킵됨' WHERE id = $1`, [rawId]);
            return;
        }

        let isRepayment = false;
        if (String(option).includes("재결제")) {
            isRepayment = true;
        } else if (!String(option).includes("/")) {
            isRepayment = true;
        }

        if (isRepayment) {
            await handleRepayment(name, normalizePhone(phone), option);
        } else {
            await handleNewEnrollment(name, normalizePhone(phone), option);
        }

        // 성공!
        await query(`UPDATE raw_webhooks SET status = 'PROCESSED', processed_at = NOW() WHERE id = $1`, [rawId]);
        console.log(`[Sheet Ingest] #${rawId} processed successfully`);

    } catch (logicError: any) {
        // 실패해도 데이터는 이미 저장됨 → 관리자가 나중에 처리 가능
        console.error(`[Sheet Ingest] #${rawId} processing failed:`, logicError.message);
        await query(`
            UPDATE raw_webhooks 
            SET status = 'NEEDS_ATTENTION', error_log = $2 
            WHERE id = $1
        `, [rawId, logicError.message]);
    }
}

// --- Logic Functions ---

function normalizePhone(phone: string) {
    if (!phone) return '';
    let p = String(phone).replace(/[^0-9]/g, '');
    if (p.startsWith('10') && p.length === 10) p = '0' + p;
    return p;
}

function parseOption(optionStr: string) {
    if (!optionStr) return null;
    const parts = optionStr.split('/');
    if (parts.length < 3) return null;
    return {
        coach: parts[0].trim(),
        day: parts[1].trim(),
        time: parts[2].trim().split('~')[0]
    };
}

async function handleNewEnrollment(name: string, phone: string, option: string) {
    const parsed = parseOption(option);
    if (!parsed) throw new Error(`옵션 형식 오류: ${option}`);

    const coachRes = await query(`SELECT id, name, phone FROM coaches WHERE name = $1`, [parsed.coach]);
    if (coachRes.rows.length === 0) throw new Error(`코치 없음: ${parsed.coach}`);
    const coach = coachRes.rows[0];

    const slotRes = await query(`SELECT * FROM coach_slots WHERE coach_id = $1 AND day_of_week = $2 AND start_time = $3`, [coach.id, parsed.day, parsed.time]);
    if (slotRes.rows.length === 0) {
        await query(`INSERT INTO coach_slots (coach_id, day_of_week, start_time, is_available) VALUES ($1, $2, $3, false)`, [coach.id, parsed.day, parsed.time]);
    }

    // "이번 주에 결제하면 무조건 다음 주 시작" (월요일 시작 기준)
    const getNextWeekDay = (date: Date, dayName: string) => {
        const dayMap: { [key: string]: number } = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
        const targetDay = dayMap[dayName.replace('요일', '')]; // 0(일) ~ 6(토)

        // ISO 기준 (월=0, ... 일=6)으로 변환
        const toIso = (d: number) => (d === 0 ? 6 : d - 1);

        const currentIso = toIso(date.getDay());
        const targetIso = toIso(targetDay);

        // 이번 주 해당 요일 찾기
        const thisWeekTarget = new Date(date);
        thisWeekTarget.setDate(date.getDate() - currentIso + targetIso);

        // 무조건 다음 주로 설정 (+7일)
        const result = new Date(thisWeekTarget);
        result.setDate(result.getDate() + 7);

        return result;
    };
    const today = new Date();
    const firstSessionDate = getNextWeekDay(today, parsed.day);
    const sessionEndDate = new Date(firstSessionDate);
    sessionEndDate.setDate(firstSessionDate.getDate() + 27);

    const userRes = await query(`
        INSERT INTO users (name, phone, status, product_type)
        VALUES ($1, $2, 'active', $3)
        ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, status='active'
        RETURNING id
    `, [name, phone, option]);
    const userId = userRes.rows[0].id;

    await query(`
        INSERT INTO sessions (user_id, coach_id, day_of_week, start_time, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5, $6)
    `, [userId, coach.id, parsed.day, parsed.time, firstSessionDate, sessionEndDate]);

    await query(`
        UPDATE coach_slots SET is_available = false, assigned_user_id = $1 
        WHERE coach_id = $2 AND day_of_week = $3 AND start_time = $4
    `, [userId, coach.id, parsed.day, parsed.time]);

    console.log(`[New Enrollment] Success: ${name} -> ${parsed.coach}`);
}

async function handleRepayment(name: string, phone: string, option: string) {
    console.log(`[Repayment] Processing: ${name} (${phone})`);

    const userRes = await query(`SELECT id, name FROM users WHERE phone = $1`, [phone]);
    if (userRes.rows.length === 0) throw new Error(`재결제 사용자 없음: ${phone}`);
    const userId = userRes.rows[0].id;

    const sessionRes = await query(`
        SELECT id, end_date FROM sessions 
        WHERE user_id = $1 
        ORDER BY end_date DESC LIMIT 1
    `, [userId]);

    if (sessionRes.rows.length === 0) throw new Error(`이전 세션 없음: ${name}`);

    const lastSession = sessionRes.rows[0];
    const newEndDate = new Date(lastSession.end_date);
    newEndDate.setDate(newEndDate.getDate() + 28);

    await query(`
        UPDATE sessions 
        SET end_date = $1, extension_count = COALESCE(extension_count, 0) + 1
        WHERE id = $2
    `, [newEndDate, lastSession.id]);

    console.log(`[Repayment] Extended to ${newEndDate.toISOString()}`);
}
