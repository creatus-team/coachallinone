import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { eachWeekOfInterval, getDay, startOfMonth, endOfMonth, isWithinInterval, format } from 'date-fns';

// 요일 문자열 -> 숫자 (0=일, 1=월, ...)
const DAY_MAP: Record<string, number> = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
};

// 특정 월에 해당 요일의 실제 날짜들 반환
function getSessionDatesInMonth(sessionStart: Date, sessionEnd: Date, dayOfWeek: string, targetMonth: Date): string[] {
    const monthStart = startOfMonth(targetMonth);
    const monthEnd = endOfMonth(targetMonth);
    const dayNum = DAY_MAP[dayOfWeek];

    if (dayNum === undefined) return [];

    const dates: string[] = [];
    const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd });

    for (const weekStart of weeks) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + ((dayNum - getDay(weekStart) + 7) % 7));

        if (
            isWithinInterval(dayDate, { start: monthStart, end: monthEnd }) &&
            isWithinInterval(dayDate, { start: sessionStart, end: sessionEnd })
        ) {
            dates.push(format(dayDate, 'M/d'));
        }
    }

    return dates;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());

    const targetMonth = new Date(year, month - 1, 1);

    try {
        const coachesRes = await query(`SELECT id, name, phone FROM coaches ORDER BY name`);

        const sessionsRes = await query(`
      SELECT 
        s.id,
        s.coach_id,
        s.day_of_week,
        s.start_time,
        s.start_date,
        s.end_date,
        u.id as student_id,
        u.name as student_name,
        u.phone as student_phone
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.start_date <= $1 AND s.end_date >= $2
    `, [endOfMonth(targetMonth), startOfMonth(targetMonth)]);

        const settlementsByCoach = coachesRes.rows.map(coach => {
            const coachSessions = sessionsRes.rows.filter(s => s.coach_id === coach.id);

            let totalSessions = 0;
            const students: {
                id: number;
                name: string;
                phone: string;
                dayOfWeek: string;
                startTime: string;
                sessionDates: string[];
                sessionCount: number;
                sessionPeriod: { start: string; end: string };
            }[] = [];

            for (const session of coachSessions) {
                const sessionDates = getSessionDatesInMonth(
                    new Date(session.start_date),
                    new Date(session.end_date),
                    session.day_of_week,
                    targetMonth
                );
                const sessionCount = sessionDates.length;
                totalSessions += sessionCount;

                students.push({
                    id: session.student_id,
                    name: session.student_name,
                    phone: session.student_phone,
                    dayOfWeek: session.day_of_week,
                    startTime: session.start_time,
                    sessionDates,
                    sessionCount,
                    sessionPeriod: {
                        start: format(new Date(session.start_date), 'yyyy.MM.dd'),
                        end: format(new Date(session.end_date), 'yyyy.MM.dd')
                    }
                });
            }

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

        const activeSettlements = settlementsByCoach.filter(s => s.totalSessions > 0);

        return NextResponse.json({
            year,
            month,
            settlements: activeSettlements,
            grandTotal: activeSettlements.reduce((sum, s) => sum + s.totalAmount, 0),
            grandTotalSessions: activeSettlements.reduce((sum, s) => sum + s.totalSessions, 0)
        });

    } catch (error: any) {
        console.error('[Settlements API Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
