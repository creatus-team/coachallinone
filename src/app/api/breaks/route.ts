import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';

export async function POST(request: Request) {
    try {
        const { sessionId, breakWeeks, reason } = await request.json();

        // 1. 세션 정보 조회
        const sessionRes = await query('SELECT * FROM sessions WHERE id = $1', [sessionId]);
        if (sessionRes.rows.length === 0) {
            return NextResponse.json({ success: false, error: '세션을 찾을 수 없습니다' }, { status: 404 });
        }
        const session = sessionRes.rows[0];

        // 2. 종료일 연장
        const endDate = new Date(session.end_date);
        endDate.setDate(endDate.getDate() + (breakWeeks * 7));

        await query('UPDATE sessions SET end_date = $1 WHERE id = $2', [endDate, sessionId]);

        // 3. 휴강 기록 저장
        await query(
            'INSERT INTO session_breaks (session_id, break_weeks, reason) VALUES ($1, $2, $3)',
            [sessionId, breakWeeks, reason]
        );

        // 4. 활동 로그 저장 (NEW)
        await query(`
            INSERT INTO user_activity_logs (user_id, action_type, old_value, new_value, reason)
            VALUES ($1, 'BREAK', $2, $3, $4)
        `, [
            session.user_id,
            `${breakWeeks}주`,
            `~${endDate.toISOString().split('T')[0]} (연장됨)`,
            reason
        ]);

        return NextResponse.json({ success: true, newEndDate: endDate });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
