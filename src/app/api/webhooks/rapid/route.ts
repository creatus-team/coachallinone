import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { addWeeks, format } from 'date-fns';

// Rapid Webhook Payload
interface RapidPayload {
    type: 'NORMAL_PAYMENT' | 'MEMBERSHIP_PAYMENT';
    payment: {
        name: string;
        email: string;
        phoneNumber: string;
        amount: number;
        status: 'SUCCESS' | 'CANCEL';
        date: string;
        method?: string;
        canceledReason?: string;
        option?: string; // "[김원민/월/14:00]6주코칭" 형태
        forms?: { question: string; answer: string }[];
        agreements?: { question: string; answer: boolean }[];
    };
}

// Parse "[코치/요일/시간]상품명" format
function parseOptionInfo(option: string) {
    const regex = /\[(.+?)\/(.+?)\/(.+?)\](.+)?/;
    const match = option.match(regex);
    if (!match) return null;
    return {
        coachName: match[1].trim(),
        dayOfWeek: match[2].trim(),
        startTime: match[3].trim(),
        productType: match[4]?.trim() || '',
    };
}

// Normalize phone number
function normalizePhone(phone: string): string {
    let p = phone.replace(/[^0-9]/g, '');
    if (p.startsWith('10') && p.length === 10) p = '0' + p;
    if (p.startsWith('82')) p = '0' + p.slice(2);
    return p;
}

export async function POST(request: Request) {
    try {
        const body: RapidPayload = await request.json();
        console.log('[Rapid Webhook] Received:', JSON.stringify(body).slice(0, 200));

        const { payment } = body;

        // Skip cancelled payments
        if (payment.status === 'CANCEL') {
            console.log('[Rapid] Payment cancelled, skipping');
            return NextResponse.json({ success: true, skipped: 'cancelled' });
        }

        const name = payment.name;
        const phone = normalizePhone(payment.phoneNumber);
        const option = payment.option || '';

        // Check if renewal (재결제)
        const isRenewal = option.includes('재결제') || body.type === 'MEMBERSHIP_PAYMENT';

        if (isRenewal) {
            return await handleRenewal(name, phone);
        } else {
            const parsed = parseOptionInfo(option);
            if (!parsed) {
                // Can't parse option, notify admin
                await notifyAdmin(`래피드 파싱 실패: ${name} (${phone}) - 옵션: ${option}`);
                // Still save user as pending
                await query(`
          INSERT INTO users (name, phone, status, product_type)
          VALUES ($1, $2, 'pending', $3)
          ON CONFLICT (phone) DO UPDATE SET name = $1, status = 'pending'
        `, [name, phone, option]);
                return NextResponse.json({ success: true, warning: 'Could not parse option' });
            }
            return await handleNewPayment(name, phone, parsed);
        }
    } catch (error: any) {
        console.error('[Rapid Webhook Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// ==================== NEW PAYMENT ====================
async function handleNewPayment(
    name: string,
    phone: string,
    info: { coachName: string; dayOfWeek: string; startTime: string; productType: string }
) {
    // 1. Find Coach
    const coachRes = await query('SELECT * FROM coaches WHERE name = $1', [info.coachName]);
    if (coachRes.rows.length === 0) {
        await notifyAdmin(`코치 없음: ${info.coachName} (신청: ${name})`);
        await query(`
      INSERT INTO users (name, phone, status, product_type)
      VALUES ($1, $2, 'pending', $3)
      ON CONFLICT (phone) DO UPDATE SET name = $1, status = 'pending', product_type = $3
    `, [name, phone, info.productType]);
        return NextResponse.json({ success: true, warning: 'Coach not found' });
    }
    const coach = coachRes.rows[0];

    // 2. Check Slot Availability
    const slotRes = await query(`
    SELECT * FROM coach_slots 
    WHERE coach_id = $1 AND day_of_week = $2 AND start_time = $3 AND is_available = true
  `, [coach.id, info.dayOfWeek, info.startTime]);

    if (slotRes.rows.length === 0) {
        await notifyAdmin(`슬롯 없음: ${info.coachName} ${info.dayOfWeek} ${info.startTime} (신청: ${name})`);
        await query(`
      INSERT INTO users (name, phone, status, product_type)
      VALUES ($1, $2, 'pending', $3)
      ON CONFLICT (phone) DO UPDATE SET name = $1, status = 'pending', product_type = $3
    `, [name, phone, info.productType]);
        return NextResponse.json({ success: true, warning: 'Slot not available' });
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
    const endDate = addWeeks(startDate, 6);
    await query(`
    INSERT INTO sessions (user_id, coach_id, slot_id, day_of_week, start_time, start_date, end_date, is_renewal)
    VALUES ($1, $2, $3, $4, $5, $6, $7, false)
  `, [userId, coach.id, slot.id, info.dayOfWeek, info.startTime, startDate, endDate]);

    // 5. Mark Slot as Taken
    await query(`UPDATE coach_slots SET is_available = false, assigned_user_id = $1 WHERE id = $2`, [userId, slot.id]);

    // 6. Send SMS Notifications
    const startDateStr = format(startDate, 'M/d(E)');

    // To Coach
    await sendSMS({
        to: coach.phone,
        text: `[크리투스] 새 수강생 배정!\n이름: ${name}\n수업: ${info.dayOfWeek} ${info.startTime}\n시작일: ${startDateStr}`,
        type: 'NEW',
        recipientName: coach.name,
    });

    // To Student
    await sendSMS({
        to: phone,
        text: `[크리투스] 코칭 배정 완료!\n담당: ${coach.name} 코치님\n첫 수업: ${startDateStr} ${info.startTime}\n오픈톡: ${coach.open_chat_link || '(링크 준비중)'}`,
        type: 'NEW',
        recipientName: name,
    });

    // To Admin
    await notifyAdmin(`[매칭완료] ${name} → ${coach.name} / ${info.dayOfWeek} ${info.startTime}`);

    console.log(`[Rapid] New payment processed: ${name} -> ${coach.name}`);
    return NextResponse.json({ success: true, userId, coachId: coach.id });
}

// ==================== RENEWAL ====================
async function handleRenewal(name: string, phone: string) {
    // 1. Find existing user
    const userRes = await query('SELECT * FROM users WHERE phone = $1', [phone]);
    if (userRes.rows.length === 0) {
        await notifyAdmin(`재결제 고객 없음: ${name} (${phone}) - DB에 없음`);
        return NextResponse.json({ success: true, warning: 'User not found for renewal' });
    }
    const user = userRes.rows[0];

    // 2. Find latest session
    const sessionRes = await query(`
    SELECT s.*, c.name as coach_name, c.phone as coach_phone
    FROM sessions s
    JOIN coaches c ON s.coach_id = c.id
    WHERE s.user_id = $1
    ORDER BY s.end_date DESC
    LIMIT 1
  `, [user.id]);

    if (sessionRes.rows.length === 0) {
        await notifyAdmin(`재결제 세션 없음: ${name} (${phone}) - 이전 세션 없음`);
        return NextResponse.json({ success: true, warning: 'No previous session found' });
    }
    const session = sessionRes.rows[0];

    // 3. Extend session by 6 weeks
    const newEndDate = addWeeks(new Date(session.end_date), 6);
    await query(`UPDATE sessions SET end_date = $1, is_renewal = true WHERE id = $2`, [newEndDate, session.id]);
    await query(`UPDATE users SET status = 'active' WHERE id = $1`, [user.id]);

    const endDateStr = format(newEndDate, 'M/d');

    // 4. Send SMS Notifications
    await sendSMS({
        to: session.coach_phone,
        text: `[크리투스] ${name}님 재등록! +6주 연장 (종료: ${endDateStr})`,
        type: 'RENEWAL',
        recipientName: session.coach_name,
    });

    await sendSMS({
        to: phone,
        text: `[크리투스] 재등록 감사합니다!\n${session.coach_name} 코치님과 계속됩니다 💪\n종료일: ${endDateStr}`,
        type: 'RENEWAL',
        recipientName: name,
    });

    await notifyAdmin(`[재등록] ${name} → ${session.coach_name} / 종료: ${endDateStr}`);

    console.log(`[Rapid] Renewal processed: ${name}`);
    return NextResponse.json({ success: true, userId: user.id, newEndDate });
}

// ==================== ADMIN NOTIFICATION ====================
async function notifyAdmin(message: string) {
    const adminPhone = process.env.ADMIN_PHONE || process.env.SOLAPI_SENDER_NUM;
    if (!adminPhone) return;
    await sendSMS({
        to: adminPhone,
        text: `[관리자] ${message}`,
        type: 'ADMIN',
        recipientName: '운영진',
    });
}
