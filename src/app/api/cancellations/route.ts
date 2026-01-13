import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { format } from 'date-fns';

// GET: 취소 요청 목록 조회
export async function GET() {
    try {
        // 처리 안 된 취소 요청 (message_logs에서 CANCEL_REQUEST 타입)
        const pendingRes = await query(`
            SELECT id, recipient_name, recipient_phone, content, sent_at, status
            FROM message_logs
            WHERE type = 'CANCEL_REQUEST' AND status = 'PENDING'
            ORDER BY sent_at DESC
        `);

        // 처리된 취소 기록
        const processedRes = await query(`
            SELECT cl.*, u.name as student_name, u.phone as student_phone
            FROM cancellation_logs cl
            JOIN users u ON cl.user_id = u.id
            ORDER BY cl.cancelled_at DESC
            LIMIT 20
        `);

        return NextResponse.json({
            success: true,
            pending: pendingRes.rows,
            processed: processedRes.rows
        });

    } catch (error: any) {
        console.error('[Cancellations GET Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: 취소 처리 (매칭 해제 + 슬롯 복구)
export async function POST(request: Request) {
    try {
        const { userId, reason, refundAmount, messageLogId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId 필수' }, { status: 400 });
        }

        // 1. 유저의 현재 세션 찾기
        const sessionRes = await query(`
            SELECT s.*, c.name as coach_name
            FROM sessions s
            JOIN coaches c ON s.coach_id = c.id
            WHERE s.user_id = $1
            ORDER BY s.end_date DESC
            LIMIT 1
        `, [userId]);

        if (sessionRes.rows.length === 0) {
            return NextResponse.json({ error: '취소할 세션이 없습니다' }, { status: 404 });
        }

        const session = sessionRes.rows[0];

        // 2. 슬롯 복구 (is_available = true, assigned_user_id = null)
        await query(`
            UPDATE coach_slots 
            SET is_available = true, assigned_user_id = NULL
            WHERE coach_id = $1 AND day_of_week = $2 AND start_time = $3
        `, [session.coach_id, session.day_of_week, session.start_time]);

        // 3. 취소 로그 기록
        await query(`
            INSERT INTO cancellation_logs (user_id, session_id, reason, refund_amount, processed, processed_at)
            VALUES ($1, $2, $3, $4, true, NOW())
        `, [userId, session.id, reason || '', refundAmount || 0]);

        // 4. 세션 삭제
        await query(`DELETE FROM sessions WHERE id = $1`, [session.id]);

        // 5. 유저 상태 업데이트
        await query(`UPDATE users SET status = 'cancelled' WHERE id = $1`, [userId]);

        // 6. message_logs에서 PENDING 상태 업데이트
        if (messageLogId) {
            await query(`
                UPDATE message_logs SET status = 'PROCESSED' WHERE id = $1
            `, [messageLogId]);
        }

        // 유저 정보 조회
        const userRes = await query(`SELECT name, phone FROM users WHERE id = $1`, [userId]);
        const user = userRes.rows[0];

        console.log('[Cancellation Processed]', {
            user: user.name,
            coach: session.coach_name,
            slot: `${session.day_of_week} ${session.start_time}`,
            refund: refundAmount
        });

        return NextResponse.json({
            success: true,
            studentName: user.name,
            coachName: session.coach_name,
            slotRestored: `${session.day_of_week} ${session.start_time}`
        });

    } catch (error: any) {
        console.error('[Cancellations POST Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
