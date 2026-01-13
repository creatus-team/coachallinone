import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { addWeeks, format } from 'date-fns';

// GET: 휴강 기록 조회
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    try {
        if (sessionId) {
            // 특정 세션의 휴강 기록
            const res = await query(`
                SELECT * FROM session_breaks 
                WHERE session_id = $1 
                ORDER BY requested_at DESC
            `, [sessionId]);
            return NextResponse.json({ success: true, breaks: res.rows });
        } else {
            // 전체 휴강 기록 (최근 순)
            const res = await query(`
                SELECT sb.*, u.name as student_name, c.name as coach_name
                FROM session_breaks sb
                JOIN sessions s ON sb.session_id = s.id
                JOIN users u ON s.user_id = u.id
                JOIN coaches c ON s.coach_id = c.id
                ORDER BY sb.requested_at DESC
                LIMIT 50
            `);
            return NextResponse.json({ success: true, breaks: res.rows });
        }
    } catch (error: any) {
        console.error('[Session Breaks GET Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST: 휴강 신청
export async function POST(request: Request) {
    try {
        const { sessionId, breakWeeks, reason } = await request.json();

        if (!sessionId || !breakWeeks) {
            return NextResponse.json({ error: 'sessionId와 breakWeeks 필수' }, { status: 400 });
        }

        if (breakWeeks < 1 || breakWeeks > 2) {
            return NextResponse.json({ error: '휴강은 1~2주만 가능' }, { status: 400 });
        }

        // 현재 세션 정보 조회
        const sessionRes = await query(`
            SELECT s.*, u.name as student_name, c.name as coach_name
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            JOIN coaches c ON s.coach_id = c.id
            WHERE s.id = $1
        `, [sessionId]);

        if (sessionRes.rows.length === 0) {
            return NextResponse.json({ error: '세션을 찾을 수 없습니다' }, { status: 404 });
        }

        const session = sessionRes.rows[0];
        const originalEndDate = new Date(session.end_date);
        const newEndDate = addWeeks(originalEndDate, breakWeeks);

        // 휴강 기록 추가
        await query(`
            INSERT INTO session_breaks (session_id, break_weeks, reason, original_end_date, new_end_date)
            VALUES ($1, $2, $3, $4, $5)
        `, [sessionId, breakWeeks, reason || '', originalEndDate, newEndDate]);

        // 세션 종료일 업데이트
        await query(`
            UPDATE sessions SET end_date = $1 WHERE id = $2
        `, [newEndDate, sessionId]);

        console.log('[Session Break Created]', {
            student: session.student_name,
            coach: session.coach_name,
            breakWeeks,
            reason,
            originalEnd: format(originalEndDate, 'yyyy-MM-dd'),
            newEnd: format(newEndDate, 'yyyy-MM-dd')
        });

        return NextResponse.json({
            success: true,
            studentName: session.student_name,
            coachName: session.coach_name,
            breakWeeks,
            originalEndDate: format(originalEndDate, 'yyyy-MM-dd'),
            newEndDate: format(newEndDate, 'yyyy-MM-dd')
        });

    } catch (error: any) {
        console.error('[Session Breaks POST Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE: 휴강 취소 (관리자용)
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const breakId = searchParams.get('id');

    if (!breakId) {
        return NextResponse.json({ error: 'id 필수' }, { status: 400 });
    }

    try {
        // 휴강 기록 조회
        const breakRes = await query(`
            SELECT * FROM session_breaks WHERE id = $1
        `, [breakId]);

        if (breakRes.rows.length === 0) {
            return NextResponse.json({ error: '휴강 기록을 찾을 수 없습니다' }, { status: 404 });
        }

        const breakRecord = breakRes.rows[0];

        // 원래 종료일로 복원
        await query(`
            UPDATE sessions SET end_date = $1 WHERE id = $2
        `, [breakRecord.original_end_date, breakRecord.session_id]);

        // 휴강 기록 삭제
        await query(`DELETE FROM session_breaks WHERE id = $1`, [breakId]);

        return NextResponse.json({ success: true, message: '휴강이 취소되었습니다' });

    } catch (error: any) {
        console.error('[Session Breaks DELETE Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
