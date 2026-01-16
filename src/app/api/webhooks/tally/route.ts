import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { addWeeks, format } from 'date-fns';
import { z } from 'zod';

// Tally Field Schema
const TallyFieldSchema = z.object({
    key: z.string(),
    label: z.string(),
    type: z.string(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

// Tally Payload Schema
const TallyPayloadSchema = z.object({
    data: z.object({
        fields: z.array(TallyFieldSchema),
    }),
});

// Normalize phone number
function normalizePhone(phone: string): string {
    let p = phone.replace(/[^0-9]/g, '');
    if (p.startsWith('10') && p.length === 10) p = '0' + p;
    if (p.startsWith('82')) p = '0' + p.slice(2);
    return p;
}

// Parse "[코치/요일/시간]상품명" format
function parsePurchaseInfo(raw: string) {
    const regex = /\[(.+?)\/(.+?)\/(.+?)\](.+?)(?:\s*\(|$)/;
    const match = raw.match(regex);
    if (!match) return null;
    return {
        coachName: match[1].trim(),
        dayOfWeek: match[2].trim(),
        startTime: match[3].trim(),
        productType: match[4].trim(),
    };
}

export async function POST(request: Request) {
    let rawId: number | null = null;

    try {
        const json = await request.json();
        console.log('[Webhook] Received Tally submission');

        // 1. Save Raw Data FIRST (The "Refrigerator" Strategy)
        const insertRes = await query(`
            INSERT INTO raw_webhooks (source, payload, status)
            VALUES ($1, $2, 'RECEIVED')
            RETURNING id
        `, ['tally', JSON.stringify(json)]);

        rawId = insertRes.rows[0].id;
        console.log(`[Webhook] Tally data saved to raw_webhooks #${rawId}`);

        // 2. Validate Payload
        const parseResult = TallyPayloadSchema.safeParse(json);
        if (!parseResult.success) {
            throw new Error(`Invalid Payload: ${parseResult.error.message}`);
        }
        const body = parseResult.data;

        // 3. Extract & Process
        let name = '';
        let phone = '';
        let purchaseRaw = '';

        for (const field of body.data.fields) {
            if (field.label.includes('이름') || field.label.includes('성함')) {
                name = String(field.value || '');
            }
            if (field.type === 'PHONE_NUMBER' || field.label.includes('전화')) {
                phone = normalizePhone(String(field.value || ''));
            }
            if (field.label.includes('결제') || field.label.includes('구매')) {
                purchaseRaw = String(field.value || '');
            }
        }

        if (!name || !phone) {
            throw new Error('Missing required fields (name or phone)');
        }

        // Determine Action
        const isRenewal = purchaseRaw.includes('재결제') || purchaseRaw === '재결제';
        let result;

        if (isRenewal) {
            result = await handleRenewal(name, phone);
        } else {
            const parsed = parsePurchaseInfo(purchaseRaw);
            if (!parsed) {
                // Parse fail is a logic error, not system error. Notify admin but mark as NEEDS_ATTENTION.
                const warnMsg = `파싱 실패: ${name} (${phone}) - ${purchaseRaw}`;
                await notifyAdmin(warnMsg);
                await updateRawStatus(rawId!, 'NEEDS_ATTENTION', warnMsg);
                return NextResponse.json({ success: true, warning: 'Could not parse, saved as needs attention' });
            }
            result = await handleNewEnrollment(name, phone, parsed);
        }

        // 4. Update Status to PROCESSED
        if (result.warning) {
            await updateRawStatus(rawId!, 'NEEDS_ATTENTION', result.warning);
        } else {
            await updateRawStatus(rawId!, 'PROCESSED');
        }

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('[Webhook Error]', error);

        // 5. Update Status to FAILED (if we have an ID)
        if (rawId) {
            await updateRawStatus(rawId, 'FAILED', error.message);
        }

        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

async function updateRawStatus(id: number, status: string, errorLog: string | null = null) {
    if (errorLog) {
        await query(`UPDATE raw_webhooks SET status = $1, error_log = $2, processed_at = NOW() WHERE id = $3`, [status, errorLog, id]);
    } else {
        await query(`UPDATE raw_webhooks SET status = $1, processed_at = NOW() WHERE id = $2`, [status, id]);
    }
}

// ==================== NEW ENROLLMENT ====================
async function handleNewEnrollment(
    name: string,
    phone: string,
    info: { coachName: string; dayOfWeek: string; startTime: string; productType: string }
) {
    // 1. Find Coach
    const coachRes = await query('SELECT * FROM coaches WHERE name = $1', [info.coachName]);
    if (coachRes.rows.length === 0) {
        await notifyAdmin(`코치 없음: ${info.coachName} (신청: ${name})`);
        return { success: true, warning: 'Coach not found' };
    }
    const coach = coachRes.rows[0];

    // 2. Check Slot Availability
    const slotRes = await query(`
    SELECT * FROM coach_slots 
    WHERE coach_id = $1 AND day_of_week = $2 AND start_time = $3 AND is_available = true
  `, [coach.id, info.dayOfWeek, info.startTime]);

    if (slotRes.rows.length === 0) {
        // Retry without checking availability (Overbooking allowed for Tally?) - PREVIOUS LOGIC WAS STRICT. KEEPING STRICT.
        await notifyAdmin(`슬롯 없음: ${info.coachName} ${info.dayOfWeek} ${info.startTime} (신청: ${name})`);
        // Save as pending user so data isn't lost
        await query(`
        INSERT INTO users (name, phone, status, product_type)
        VALUES ($1, $2, 'pending', $3)
        ON CONFLICT (phone) DO UPDATE SET name = $1, status = 'pending', product_type = $3
        `, [name, phone, info.productType]);
        return { success: true, warning: 'Slot not available' };
    }
    const slot = slotRes.rows[0];

    // 3. Create/Update User
    const userRes = await query(`
    INSERT INTO users (name, phone, status, product_type)
    VALUES ($1, $2, 'active', $3)
    ON CONFLICT (phone) DO UPDATE SET name = $1, status = 'active', product_type = $3
    RETURNING id
  `, [name, phone, info.productType]);
    const userId = userRes.rows[0].id;

    // 4. Create Session
    const startDate = new Date();
    const endDate = addWeeks(startDate, 6); // Tally Default: Start Today, +6 Weeks.

    await query(`
    INSERT INTO sessions (user_id, coach_id, slot_id, day_of_week, start_time, start_date, end_date, is_renewal)
    VALUES ($1, $2, $3, $4, $5, $6, $7, false)
  `, [userId, coach.id, slot.id, info.dayOfWeek, info.startTime, startDate, endDate]);

    // 5. Mark Slot as Taken
    await query(`UPDATE coach_slots SET is_available = false, assigned_user_id = $1 WHERE id = $2`, [userId, slot.id]);

    // 6. Log Activity (NEW)
    await query(`
        INSERT INTO user_activity_logs (user_id, action_type, reason)
        VALUES ($1, 'ENROLL', $2)
    `, [userId, `Tally 신규 신청 (담당: ${coach.name})`]);

    // 7. Send SMS Notifications (DISABLED as per user rule)
    /*
    const startDateStr = format(startDate, 'M/d(E)');
    await sendSMS({ to: coach.phone, text: `[크리투스] 새 수강생 배정!\n이름: ${name}\n수업: ${info.dayOfWeek} ${info.startTime}\n시작일: ${startDateStr}`, type: 'NEW', recipientName: coach.name });
    await sendSMS({ to: phone, text: `[크리투스] 코칭 배정 완료!\n담당: ${coach.name} 코치님\n첫 수업: ${startDateStr} ${info.startTime}\n오픈톡: ${coach.open_chat_link || '(링크 준비중)'}`, type: 'NEW', recipientName: name });
    await notifyAdmin(`[매칭완료] ${name} → ${coach.name} / ${info.dayOfWeek} ${info.startTime}`);
    */
    console.log(`[Webhook] New enrollment processed: ${name} -> ${coach.name}`);
    return { success: true, userId, coachId: coach.id };
}

// ==================== RENEWAL (Unchanged Logic, just Helper) ====================
async function handleRenewal(name: string, phone: string) {
    const userRes = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (userRes.rows.length === 0) {
        await notifyAdmin(`재결제 고객 없음: ${name} (${phone}) - DB에 없음`);
        return { success: true, warning: 'User not found for renewal' };
    }
    const user = userRes.rows[0];

    // Find latest session with explicit column selection to avoid ambiguous 'status'
    const sessionRes = await query(`
    SELECT s.id, s.end_date, s.coach_id, c.name as coach_name, c.phone as coach_phone
    FROM sessions s
    JOIN coaches c ON s.coach_id = c.id
    WHERE s.user_id = $1
    ORDER BY s.end_date DESC
    LIMIT 1
  `, [user.id]);

    if (sessionRes.rows.length === 0) {
        await notifyAdmin(`재결제 세션 없음: ${name} (${phone}) - 이전 세션 없음`);
        return { success: true, warning: 'No previous session found' };
    }
    const session = sessionRes.rows[0];

    const newEndDate = addWeeks(new Date(session.end_date), 6);
    await query(`UPDATE sessions SET end_date = $1, is_renewal = true WHERE id = $2`, [newEndDate, session.id]);
    await query(`UPDATE users SET status = 'active' WHERE id = $1`, [user.id]);

    // Log Activity (NEW)
    await query(`
        INSERT INTO user_activity_logs (user_id, action_type, reason)
        VALUES ($1, 'RENEWAL', $2)
    `, [user.id, `Tally 재결제 +4주 연장 (종료: ${format(newEndDate, 'yyyy-MM-dd')})`]);

    /*
    const endDateStr = format(newEndDate, 'M/d');
    await sendSMS({ to: session.coach_phone, text: `[크리투스] ${name}님 재등록! +6주 연장 (종료: ${endDateStr})`, type: 'RENEWAL', recipientName: session.coach_name });
    await sendSMS({ to: phone, text: `[크리투스] 재등록 감사합니다!\n${session.coach_name} 코치님과 계속됩니다 💪\n종료일: ${endDateStr}`, type: 'RENEWAL', recipientName: name });
    await notifyAdmin(`[재등록] ${name} → ${session.coach_name} / 종료: ${endDateStr}`);
    */
    console.log(`[Webhook] Renewal processed: ${name}`);
    return { success: true, userId: user.id, newEndDate };
}

async function notifyAdmin(message: string) {
    const adminPhone = process.env.ADMIN_PHONE || process.env.SOLAPI_SENDER_NUM;
    if (!adminPhone) { console.warn('[Admin] No admin phone configured'); return; }
    await sendSMS({ to: adminPhone, text: `[관리자] ${message}`, type: 'ADMIN', recipientName: '운영진' });
}
