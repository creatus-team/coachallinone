import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

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

    let rawId: number | null = null;
    try {
        const insertRes = await query(`
            INSERT INTO raw_webhooks (source, payload, status)
            VALUES ($1, $2, 'PENDING')
            RETURNING id
        `, ['google_sheet', body]);

        if (insertRes.rows.length > 0) {
            rawId = insertRes.rows[0].id;
        }
    } catch (dbError) {
        console.error('[Sheet Ingest] Raw Save Error:', dbError);
        return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }

    // 2. 비즈니스 로직 분기
    const { name, phone, option } = body;

    try {
        // [핵심] 분류 로직
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

        await query(`UPDATE raw_webhooks SET status = 'PROCESSED', processed_at = NOW() WHERE id = $1`, [rawId]);
        return NextResponse.json({ success: true, rawId });

    } catch (logicError: any) {
        console.error('[Sheet Ingest] Logic Error:', logicError);
        await query(`UPDATE raw_webhooks SET status = 'FAILED', error_log = $2 WHERE id = $1`, [rawId, logicError.message]);
        return NextResponse.json({ error: logicError.message, rawId }, { status: 500 });
    }
}

// --- Logic Functions ---

function parseOption(optionStr: string) {
    if (!optionStr) return null;
    const parts = optionStr.split('/');
    if (parts.length < 3) return null;
    return {
        coach: parts[0].trim(),
        day: parts[1].trim(),
        time: parts[2].trim().split('~')[0] // Remove end time if exists
    };
}

async function handleNewEnrollment(name: string, phone: string, option: string) {
    const parsed = parseOption(option);
    if (!parsed) throw new Error(`Invalid Option Format: ${option}`);

    // A. Coach Find
    const coachRes = await query(`SELECT id, name, phone FROM coaches WHERE name = $1`, [parsed.coach]);
    if (coachRes.rows.length === 0) throw new Error(`Coach not found: ${parsed.coach}`);
    const coach = coachRes.rows[0];

    // B. Slot Find/Create
    const slotRes = await query(`SELECT * FROM coach_slots WHERE coach_id = $1 AND day_of_week = $2 AND start_time = $3`, [coach.id, parsed.day, parsed.time]);
    if (slotRes.rows.length === 0) {
        await query(`INSERT INTO coach_slots (coach_id, day_of_week, start_time, is_available) VALUES ($1, $2, $3, false)`, [coach.id, parsed.day, parsed.time]);
    }

    // C. Usesr/Session Create
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

    // User
    const userRes = await query(`
        INSERT INTO users (name, phone, status, product_type)
        VALUES ($1, $2, 'active', $3)
        ON CONFLICT (phone) DO UPDATE SET name=EXCLUDED.name, status='active'
        RETURNING id
    `, [name, phone, option]);
    const userId = userRes.rows[0].id;

    // Session
    const sessionRes = await query(`
        INSERT INTO sessions (user_id, coach_id, day_of_week, start_time, start_date, end_date, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'upcoming')
        RETURNING id
    `, [userId, coach.id, parsed.day, parsed.time, firstSessionDate, sessionEndDate]);

    // Slot Assign
    await query(`
        UPDATE coach_slots SET is_available = false, assigned_user_id = $1 
        WHERE coach_id = $2 AND day_of_week = $3 AND start_time = $4
    `, [userId, coach.id, parsed.day, parsed.time]);

    console.log(`[New Enrollment] Success: ${name} (${parsed.coach})`);
}

async function handleRepayment(name: string, phone: string, option: string) {
    console.log(`[Repayment] Processing for ${name} (${phone})`);

    const userRes = await query(`SELECT id, name FROM users WHERE phone = $1`, [phone]);
    if (userRes.rows.length === 0) throw new Error(`Repayment User not found: ${phone}`);
    const userId = userRes.rows[0].id;

    const sessionRes = await query(`
        SELECT id, end_date, coach_id, day_of_week, start_time 
        FROM sessions 
        WHERE user_id = $1 
        ORDER BY end_date DESC 
        LIMIT 1
    `, [userId]);

    if (sessionRes.rows.length === 0) throw new Error(`No previous session found for repayment user: ${name}`);

    const lastSession = sessionRes.rows[0];
    const currentEndDate = new Date(lastSession.end_date);

    const newEndDate = new Date(currentEndDate);
    newEndDate.setDate(newEndDate.getDate() + 28);

    await query(`
        UPDATE sessions 
        SET end_date = $1, status = 'active', extension_count = COALESCE(extension_count, 0) + 1
        WHERE id = $2
    `, [newEndDate, lastSession.id]);

    console.log(`[Repayment] Extended Session ${lastSession.id} to ${newEndDate.toISOString()}`);
}
