import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: 시스템 알림 목록 조회
export async function GET() {
    try {
        const res = await query(`
            SELECT id, type, recipient_name, recipient_phone, content, status, sent_at
            FROM message_logs
            WHERE type IN ('SYSTEM_ALERT', 'CANCEL_REQUEST')
            ORDER BY 
                CASE WHEN status = 'PENDING' THEN 0 ELSE 1 END,
                sent_at DESC
            LIMIT 100
        `);

        return NextResponse.json({ success: true, alerts: res.rows });
    } catch (error: any) {
        console.error('[Alerts GET Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PATCH: 알림 상태 업데이트 (처리 완료 등)
export async function PATCH(request: Request) {
    try {
        const { id, status } = await request.json();

        if (!id || !status) {
            return NextResponse.json({ error: 'id와 status 필수' }, { status: 400 });
        }

        await query(`
            UPDATE message_logs SET status = $1 WHERE id = $2
        `, [status, id]);

        return NextResponse.json({ success: true, message: '상태가 업데이트되었습니다' });
    } catch (error: any) {
        console.error('[Alerts PATCH Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
