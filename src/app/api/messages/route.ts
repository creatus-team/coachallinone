import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { addHours, format, startOfDay, endOfDay, addDays } from 'date-fns';

// GET: 문자 발송 현황 조회
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 필터: 타입
    const status = searchParams.get('status'); // 필터: SENT, FAILED, PENDING
    const limit = parseInt(searchParams.get('limit') || '100');
    const includeScheduled = searchParams.get('includeScheduled') === 'true';

    try {
        // 발송 완료/실패 로그
        let whereClause = 'WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

        if (type) {
            whereClause += ` AND type = $${paramIndex++}`;
            params.push(type);
        }
        if (status) {
            whereClause += ` AND status = $${paramIndex++}`;
            params.push(status);
        }

        const logsRes = await query(`
            SELECT 
                id, type, recipient_name, recipient_phone, content, 
                status, sent_at, scheduled_at, is_sent
            FROM message_logs
            ${whereClause}
            ORDER BY COALESCE(scheduled_at, sent_at) DESC
            LIMIT $${paramIndex}
        `, [...params, limit]);

        // 예정 문자 (D-2, D-1 리마인더) 미리보기
        let scheduled: any[] = [];
        if (includeScheduled) {
            scheduled = await getScheduledReminders();
        }

        // 통계
        const statsRes = await query(`
            SELECT 
                COUNT(*) FILTER (WHERE status = 'SENT') as sent_count,
                COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count,
                COUNT(*) FILTER (WHERE sent_at >= CURRENT_DATE) as today_count
            FROM message_logs
        `);

        return NextResponse.json({
            success: true,
            logs: logsRes.rows,
            scheduled,
            stats: statsRes.rows[0]
        });

    } catch (error: any) {
        console.error('[Messages GET Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 예정된 D-2, D-1 리마인더 계산
async function getScheduledReminders() {
    const today = new Date();
    const scheduled: any[] = [];

    // 2-3일 후 수업 예정자 (D-2 대상)
    const d2Target = addDays(today, 2);
    const d1Target = addDays(today, 1);

    // D-2 대상자 조회 (2일 후 수업 예정)
    const d2Res = await query(`
        SELECT 
            s.id as session_id,
            u.name as student_name,
            u.phone as student_phone,
            c.name as coach_name,
            s.day_of_week,
            s.start_time,
            s.start_date,
            s.end_date
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        JOIN coaches c ON s.coach_id = c.id
        WHERE s.start_date <= $1 AND s.end_date >= $1
    `, [d2Target]);

    // 요일 매칭 확인 후 추가
    const getDayName = (date: Date): string => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return days[date.getDay()];
    };

    for (const row of d2Res.rows) {
        if (row.day_of_week === getDayName(d2Target)) {
            scheduled.push({
                type: 'D-2',
                targetDate: format(d2Target, 'M/d (EEE)'),
                studentName: row.student_name,
                studentPhone: row.student_phone,
                coachName: row.coach_name,
                time: row.start_time
            });
        }
    }

    // D-1 대상자 조회 (1일 후 수업 예정)
    const d1Res = await query(`
        SELECT 
            s.id as session_id,
            u.name as student_name,
            u.phone as student_phone,
            c.name as coach_name,
            s.day_of_week,
            s.start_time,
            s.start_date,
            s.end_date
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        JOIN coaches c ON s.coach_id = c.id
        WHERE s.start_date <= $1 AND s.end_date >= $1
    `, [d1Target]);

    for (const row of d1Res.rows) {
        if (row.day_of_week === getDayName(d1Target)) {
            scheduled.push({
                type: 'D-1',
                targetDate: format(d1Target, 'M/d (EEE)'),
                studentName: row.student_name,
                studentPhone: row.student_phone,
                coachName: row.coach_name,
                time: row.start_time
            });
        }
    }

    return scheduled;
}
