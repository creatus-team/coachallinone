import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { z } from 'zod';

// Zod Schema for Sheet Payload
const SheetPayloadSchema = z.object({
    name: z.string().min(1, "이름 필수"),
    phone: z.string().min(1, "전화번호 필수"),
    option: z.string().min(1, "옵션 필수 (코치/요일/시간)"),
}).catchall(z.any()); // Allow other fields (like source info)

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

    // 3. 데이터 검증 (Validation)
    const validation = SheetPayloadSchema.safeParse(body);
    if (!validation.success) {
        const errorMsg = `Validation Failed: ${validation.error.message}`;
        console.warn(`[Sheet Ingest] #${rawId} Invalid Payload:`, errorMsg);

        // 유효하지 않은 데이터는 'NEEDS_ATTENTION'으로 마킹하고 처리 중단
        await query(`
            UPDATE raw_webhooks 
            SET status = 'NEEDS_ATTENTION', error_log = $2, processed_at = NOW()
            WHERE id = $1
        `, [rawId, errorMsg]);

        return NextResponse.json({ success: true, warning: 'Invalid payload saved', rawId });
    }

    // 4. 비동기 처리 시도 (검증 통과한 경우만)
    processInBackground(rawId, body).catch(err => {
        console.error(`[Sheet Ingest] Background processing failed for #${rawId}:`, err);
    });

    return NextResponse.json({ success: true, rawId, message: '데이터 수신 및 검증 완료' });
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

async function handleCancellation(name: string, phone: string, rawId: number) {
    // 1. Ensure Table Exists
    await query(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          action_type VARCHAR(50) NOT NULL,
          old_value TEXT,
          new_value TEXT,
          reason TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Find User
    const userRes = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (userRes.rows.length === 0) {
        throw new Error(`취소 처리 대상 없음: ${name} (${phone})`);
    }
    const user = userRes.rows[0];

    // 3. Find Active Session
    const sessionRes = await query(`
        SELECT s.*, c.name as coach_name
        FROM sessions s
        LEFT JOIN coaches c ON s.coach_id = c.id
        WHERE s.user_id = $1 AND s.end_date >= NOW()
        ORDER BY s.end_date DESC LIMIT 1
    `, [user.id]);

    let logMessage = "결제 취소 감지됨 (세션 없음)";
    // let coachName = "알수없음"; // SMS Not Used due to exclusion

    if (sessionRes.rows.length > 0) {
        const session = sessionRes.rows[0];
        // coachName = session.coach_name;

        // 4. Terminate Session (Set end_date to yesterday)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        await query(`
            UPDATE sessions 
            SET end_date = $1 
            WHERE id = $2
        `, [yesterday, session.id]);

        // 5. Free up the slot
        await query(`
            UPDATE coach_slots 
            SET is_available = true, assigned_user_id = NULL 
            WHERE assigned_user_id = $1
        `, [user.id]);

        logMessage = `세션 종료 및 슬롯 개방 완료 (담당: ${session.coach_name})`;
        console.log(`[Cancellation] Session terminated and slots freed for user ${user.id}`);
    }

    // 6. Log Activity
    await query(`
        INSERT INTO user_activity_logs (user_id, action_type, reason)
        VALUES ($1, 'CANCEL', $2)
    `, [user.id, '결제 취소/환불로 인한 자동 종료']);

    // 7. Notify Admin (SKIPPED as per User Request "SMS 배제")
    // await notifyAdmin(`[취소처리] ${name} (${coachName}) - ${logMessage}`);

    // 8. Mark Webhook
    await query(`
        UPDATE raw_webhooks 
        SET status = 'PROCESSED', error_log = '취소 처리 완료' 
        WHERE id = $1
    `, [rawId]);
}

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

    // Log Activity (NEW)
    await query(`
        INSERT INTO user_activity_logs (user_id, action_type, reason)
        VALUES ($1, 'ENROLL', $2)
    `, [userId, `신규 수강 신청 (담당: ${parsed.coach})`]);

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

    // Log Activity (NEW)
    await query(`
        INSERT INTO user_activity_logs (user_id, action_type, reason)
        VALUES ($1, 'RENEWAL', $2)
    `, [userId, `재결제 4주 연장 (종료일: ${newEndDate.toISOString().split('T')[0]})`]);

    console.log(`[Repayment] Extended to ${newEndDate.toISOString()}`);
}
