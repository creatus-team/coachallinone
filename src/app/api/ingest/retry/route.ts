import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * 🔄 재처리 API
 * POST /api/ingest/retry
 * Body: { rawId: number }
 * 
 * raw_webhooks에서 해당 ID의 데이터를 다시 처리 시도
 */

export async function POST(request: Request) {
    let body: any;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { rawId } = body;
    if (!rawId) {
        return NextResponse.json({ error: 'rawId is required' }, { status: 400 });
    }

    // 1. 해당 raw_webhook 조회
    const webhookRes = await query(`SELECT * FROM raw_webhooks WHERE id = $1`, [rawId]);
    if (webhookRes.rows.length === 0) {
        return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
    }

    const webhook = webhookRes.rows[0];
    const payload = typeof webhook.payload === 'string' ? JSON.parse(webhook.payload) : webhook.payload;
    const { name, phone, option } = payload;

    // 0. 취소/실패 건 필터링 (강력한 방어)
    const allValues = Object.values(payload).join(' ');
    if (allValues.includes('취소') || allValues.includes('실패') || allValues.includes('환불')) {
        await query(`UPDATE raw_webhooks SET status = 'SKIPPED', error_log = '재처리 시도했으나 취소/실패/환불 건으로 스킵됨' WHERE id = $1`, [rawId]);
        return NextResponse.json({ success: true, message: '취소/실패 건이라 스킵되었습니다.' });
    }

    // 2. 재처리 시도
    try {
        let isRepayment = false;
        if (String(option).includes("재결제")) {
            isRepayment = true;
        } else if (!String(option).includes("/")) {
            isRepayment = true;
        }

        if (isRepayment) {
            await handleRepayment(name, phone, option);
        } else {
            await handleNewEnrollment(name, phone, option);
        }

        // 성공!
        await query(`UPDATE raw_webhooks SET status = 'PROCESSED', processed_at = NOW(), error_log = NULL WHERE id = $1`, [rawId]);
        return NextResponse.json({ success: true, message: '재처리 성공!' });

    } catch (error: any) {
        // 여전히 실패
        await query(`UPDATE raw_webhooks SET error_log = $2 WHERE id = $1`, [rawId, error.message]);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// --- Logic Functions (재사용) ---

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

    const getNextWeekDay = (date: Date, dayName: string) => {
        const dayMap: { [key: string]: number } = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
        const targetDay = dayMap[dayName.replace('요일', '')];
        const result = new Date(date);
        result.setDate(date.getDate() + ((7 + targetDay - date.getDay()) % 7));
        if (result.getDay() === date.getDay()) result.setDate(result.getDate() + 7);
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
}

async function handleRepayment(name: string, phone: string, option: string) {
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
}
