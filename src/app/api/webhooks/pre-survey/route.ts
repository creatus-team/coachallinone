import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';

// Notion DB Link
const NOTION_DB_LINK = 'https://loat.notion.site/DB-2c434088a27d80a9b159cde35db969cf?source=copy_link';

// Tally Payload Type
interface TallyField {
    key: string;
    label: string;
    type: string;
    value: string | number | boolean | null;
}

interface TallyPayload {
    data: {
        fields: TallyField[];
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
        const body: TallyPayload = await request.json();
        console.log('[사전설문 Webhook] Received');

        // 1. Extract fields
        let studentName = '';
        let phone = '';

        for (const field of body.data.fields) {
            if (field.label.includes('이름') || field.label.includes('성함')) {
                studentName = String(field.value || '');
            }
            if (field.type === 'PHONE_NUMBER' || field.label.includes('전화')) {
                phone = normalizePhone(String(field.value || ''));
            }
        }

        if (!phone) {
            console.log('[사전설문] 전화번호 없음, 스킵');
            return NextResponse.json({ success: true, skipped: true });
        }

        // 2. Find user and their coach
        const sessionRes = await query(`
      SELECT 
        u.name as user_name,
        c.name as coach_name,
        c.phone as coach_phone
      FROM users u
      JOIN sessions s ON u.id = s.user_id
      JOIN coaches c ON s.coach_id = c.id
      WHERE u.phone = $1
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [phone]);

        if (sessionRes.rows.length === 0) {
            console.log(`[사전설문] 해당 전화번호(${phone})의 수강생/코치 정보 없음`);
            // Still log it
            await query(`
        INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
        VALUES ('PRE_SURVEY', $1, $2, '담당 코치 없음 - 알림 미발송', 'SKIPPED')
      `, [studentName || 'Unknown', phone]);
            return NextResponse.json({ success: true, warning: 'No coach found' });
        }

        const { user_name, coach_name, coach_phone } = sessionRes.rows[0];
        const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });

        // 3. Send SMS to Student (Receipt Confirmation)
        await sendSMS({
            to: phone,
            text: `[크리투스] ${user_name || studentName}님, 코칭 사전 설문이 정상적으로 접수되었습니다. (${timestamp})`,
            type: 'PRE_SURVEY',
            recipientName: user_name || studentName,
        });

        // 4. Send SMS to Coach (Submission Alert)
        await sendSMS({
            to: coach_phone,
            text: `[크리투스] ${coach_name} 코치님, ${user_name || studentName}님의 사전 설문이 제출되었습니다.\n확인해주세요!\n\n[피드백 신청 DB]\n${NOTION_DB_LINK}`,
            type: 'PRE_SURVEY',
            recipientName: coach_name,
        });

        console.log(`[사전설문] ${user_name} → ${coach_name} 알림 발송 완료`);
        return NextResponse.json({ success: true, notified: coach_name });

    } catch (error: any) {
        console.error('[사전설문 Webhook Error]', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
