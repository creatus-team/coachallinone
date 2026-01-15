import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: Request) {
    try {
        const { userId, reason } = await request.json();

        if (!userId) {
            return NextResponse.json({ success: false, error: 'User ID is required' }, { status: 400 });
        }

        // 1. 현재 세션 정보 가져오기 (로그용)
        const sessionRes = await query('SELECT * FROM sessions WHERE user_id = $1 ORDER BY end_date DESC LIMIT 1', [userId]);
        const session = sessionRes.rows[0];

        // 2. 세션 삭제
        await query('DELETE FROM sessions WHERE user_id = $1', [userId]);

        // 3. 슬롯 초기화
        await query('UPDATE coach_slots SET is_available = true, assigned_user_id = NULL WHERE assigned_user_id = $1', [userId]);

        // 4. 상태 변경 (종료)
        await query("UPDATE users SET status = '종료' WHERE id = $1", [userId]);

        // 5. 활동 로그 저장 (NEW)
        await query(`
            INSERT INTO user_activity_logs (user_id, action_type, old_value, new_value, reason)
            VALUES ($1, 'CANCEL', $2, '매칭 취소', $3)
        `, [
            userId,
            session ? `코치 ${session.coach_id}` : '배정됨',
            reason
        ]);

        return NextResponse.json({ success: true });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
