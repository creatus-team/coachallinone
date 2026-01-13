import { SolapiMessageService } from 'solapi';
import { query } from './db';

const messageService = new SolapiMessageService(
    process.env.SOLAPI_API_KEY!,
    process.env.SOLAPI_API_SECRET!
);

interface SMSParams {
    to: string;
    text: string;
    type: 'NEW' | 'RENEWAL' | 'D-2' | 'D-1' | 'ADMIN';
    recipientName: string;
}

export async function sendSMS({ to, text, type, recipientName }: SMSParams) {
    // Normalize phone number
    let phone = to.replace(/[^0-9]/g, '');
    if (phone.startsWith('10') && phone.length === 10) phone = '0' + phone;
    if (phone.startsWith('82')) phone = '0' + phone.slice(2);

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
