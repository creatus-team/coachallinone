import { SolapiMessageService } from 'solapi';
import { query } from './db';

// 🔒 SMS 발송 비활성화 플래그 (true로 변경하면 발송 활성화)
const SMS_ENABLED = false;

const messageService = new SolapiMessageService(
    process.env.SOLAPI_API_KEY!,
    process.env.SOLAPI_API_SECRET!
);

interface SMSParams {
    to: string;
    text: string;
    type: 'NEW' | 'RENEWAL' | 'D-2' | 'D-1' | 'ADMIN' | 'PRE_SURVEY' | 'COACHING_FORM';
    recipientName: string;
}

export async function sendSMS({ to, text, type, recipientName }: SMSParams) {
    // Normalize phone number
    let phone = to.replace(/[^0-9]/g, '');
    if (phone.startsWith('10') && phone.length === 10) phone = '0' + phone;
    if (phone.startsWith('82')) phone = '0' + phone.slice(2);

    // 🔒 SMS 비활성화 시 로그만 기록
    if (!SMS_ENABLED) {
        console.log(`[SMS DISABLED] Would send to: ${phone} | Type: ${type}`);
        console.log(`[SMS DISABLED] Content: ${text.substring(0, 50)}...`);

        // DB에는 기록 (추적용)
        await query(`
            INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
            VALUES ($1, $2, $3, $4, 'DISABLED')
        `, [type, recipientName, phone, `[발송안됨] ${text}`]);

        return { success: true, disabled: true };
    }

    try {
        const res = await messageService.sendOne({
            to: phone,
            from: process.env.SOLAPI_SENDER_NUM!,
            text,
        });

        console.log(`[SMS Sent] To: ${phone} | Type: ${type}`);

        // Log to DB
        await query(`
      INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
      VALUES ($1, $2, $3, $4, 'SENT')
    `, [type, recipientName, phone, text]);

        return { success: true, messageId: res.groupId };
    } catch (error: any) {
        console.error(`[SMS Failed] ${error.message}`);

        // Log failure to DB
        await query(`
      INSERT INTO message_logs (type, recipient_name, recipient_phone, content, status)
      VALUES ($1, $2, $3, $4, 'FAILED')
    `, [type, recipientName, phone, `ERROR: ${error.message} | ${text}`]);

        return { success: false, error: error.message };
    }
}

