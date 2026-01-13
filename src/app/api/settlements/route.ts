import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { eachWeekOfInterval, getDay, startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns';

// 요일 문자열 -> 숫자 (0=일, 1=월, ...)
const DAY_MAP: Record<string, number> = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
};

// 특정 월에 해당 요일이 몇 번 있는지 계산
function countSessionsInMonth(sessionStart: Date, sessionEnd: Date, dayOfWeek: string, targetMonth: Date): number {
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);
    const dayNum = DAY_MAP[dayOfWeek];

    if (dayNum === undefined) return 0;

    let count = 0;

    // 해당 월의 모든 주를 순회
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd });

    for (const weekStart of weeks) {
        // 해당 주에서 특정 요일의 날짜 계산
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + ((dayNum - getDay(weekStart) + 7) % 7));

        // 해당 날짜가 세션 기간과 월 범위 모두에 포함되는지 확인
        if (
            isWithinInterval(dayDate, { start: monthStart, end: monthEnd }) &&
            isWithinInterval(dayDate, { start: sessionStart, end: sessionEnd })
        ) {
            count++;
        }
    }

    return count;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    const targetMonth = new Date(year, month - 1, 1);

    try {
        // 모든 코치 가져오기
        const coachesRes = await query(`SELECT id, name, phone FROM coaches ORDER BY name`);

        // 해당 월에 활성화된 세션 가져오기 (세션 기간이 해당 월과 겹치는 것)
        const sessionsRes = await query(`
      SELECT 
        s.id,
        s.coach_id,
        s.day_of_week,
        s.start_date,
        s.end_date,
        u.name as student_name
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.start_date <= $1 AND s.end_date >= $2
    `, [endOfMonth(targetMonth), startOfMonth(targetMonth)]);

        // 코치별로 집계
        const settlementsByCoach = coachesRes.rows.map(coach => {
            const coachSessions = sessionsRes.rows.filter(s => s.coach_id === coach.id);

            let totalSessions = 0;
            const students: { name: string; sessions: number }[] = [];

            for (const session of coachSessions) {
                const sessionCount = countSessionsInMonth(
                    new Date(session.start_date),
                    new Date(session.end_date),
                    session.day_of_week,
                    targetMonth
                );
                totalSessions += sessionCount;
                students.push({
                    name: session.student_name,
                    sessions: sessionCount
                });
            }

            // 정산 금액 계산 (1회당 35,000원 가정)
            const pricePerSession = 35000;
            const totalAmount = totalSessions * pricePerSession;

            return {
                coachId: coach.id,
                coachName: coach.name,
                coachPhone: coach.phone,
                studentCount: coachSessions.length,
                totalSessions,
                pricePerSession,
                totalAmount,
                students
            };
        });

        // 세션이 있는 코치만 필터링
        const activeSettlements = settlementsByCoach.filter(s => s.totalSessions > 0);

        return NextResponse.json({
            year,
            month,
            settlements: activeSettlements,
            grandTotal: activeSettlements.reduce((sum, s) => sum + s.totalAmount, 0)
        });

    } catch (error: any) {
        console.error('[Settlements API Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
