import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { format, addDays, subDays, isSameDay, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';

// 코칭신청서 링크 (원본 GAS에서 사용)
const SURVEY_LINK = 'https://tally.so/r/81qKPr';

// Day mapping: 일(0), 월(1), 화(2), 수(3), 목(4), 금(5), 토(6)
const DAY_MAP: Record<string, number> = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
};

const DAY_NAME: Record<string, string> = {
    '월': '월요일', '화': '화요일', '수': '수요일', '목': '목요일',
    '금': '금요일', '토': '토요일', '일': '일요일'
};

// Convert day_of_week (월, 화...) to next occurrence date
function getNextSessionDate(dayOfWeek: string, timeStr: string, fromDate: Date = new Date()): Date {
    const targetDay = DAY_MAP[dayOfWeek];
    if (targetDay === undefined) return fromDate;

    const currentDay = getDay(fromDate);
    let daysUntil = targetDay - currentDay;

    // If it's today, check if the time has passed
    if (daysUntil === 0) {
        const [h, m] = timeStr.split(':').map(Number);
        if (fromDate.getHours() > h || (fromDate.getHours() === h && fromDate.getMinutes() >= m)) {
            daysUntil = 7; // Next week
        }
    } else if (daysUntil < 0) {
        daysUntil += 7;
    }

    const result = addDays(fromDate, daysUntil);
    const [h, m] = timeStr.split(':').map(Number);
    result.setHours(h, m, 0, 0);
    return result;
}

// Calculate hours until session
function getHoursUntilSession(sessionDate: Date): number {
    return (sessionDate.getTime() - Date.now()) / (1000 * 60 * 60);
}

export async function GET(request: Request) {
    try {
        // Get all active sessions with user and coach info
        const sessionsRes = await query(`
      SELECT 
        s.*, 
        u.name as user_name, u.phone as user_phone,
        c.name as coach_name, c.phone as coach_phone
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      JOIN coaches c ON s.coach_id = c.id
      WHERE u.status = 'active'
        AND s.end_date >= CURRENT_DATE
    `);

        const sessions = sessionsRes.rows;
        const results = {
            sent: [] as string[],
            skipped: [] as string[],
            errors: [] as string[]
        };

        for (const session of sessions) {
            const sessionDate = getNextSessionDate(session.day_of_week, session.start_time);
            const diffHours = getHoursUntilSession(sessionDate);
            const dayStr = DAY_NAME[session.day_of_week] || session.day_of_week;

            // ===== D-2 (48시간 전 알림) =====
            // 원본 GAS: 46 <= diffH <= 50
            if (diffHours >= 46 && diffHours <= 50) {
                try {
                    const msg = `[크리투스 코칭신청 리마인드]\n\n${session.user_name}님, 모레(${dayStr}) 코칭 48시간 전입니다.\n코칭신청서 작성 부탁드려요!\n👉 ${SURVEY_LINK}`;

                    await sendSMS({
                        to: session.user_phone,
                        text: msg,
                        type: 'D-2',
                        recipientName: session.user_name,
                    });
                    results.sent.push(`D-2: ${session.user_name} (${diffHours.toFixed(0)}시간 전)`);
                } catch (e: any) {
                    results.errors.push(`D-2 실패: ${session.user_name} - ${e.message}`);
                }
            }

            // ===== D-1 (30시간 전 마감임박 알림) =====
            // 원본 GAS: 28 <= diffH <= 32
            else if (diffHours >= 28 && diffHours <= 32) {
                try {
                    const msg = `[크리투스 코칭신청 리마인드]\n\n${session.user_name}님, 코칭 30시간 전 입니다! 만약 아직 작성 전이라면 반드시 "지금" 코칭신청서를 작성해주세요.\n👉 ${SURVEY_LINK}\n\n(코칭 24시간 이내 미접수 시 피드백 녹화본 전달 혹은 간이 코칭으로 진행됩니다.)`;

                    await sendSMS({
                        to: session.user_phone,
                        text: msg,
                        type: 'D-1',
                        recipientName: session.user_name,
                    });
                    results.sent.push(`D-1: ${session.user_name} (${diffHours.toFixed(0)}시간 전)`);
                } catch (e: any) {
                    results.errors.push(`D-1 실패: ${session.user_name} - ${e.message}`);
                }
            }

            // Outside of reminder windows
            else {
                results.skipped.push(`${session.user_name}: ${diffHours.toFixed(0)}시간 후 수업`);
            }
        }

        console.log('[Reminder Cron] Results:', results);

        return NextResponse.json({
            success: true,
            timestamp: new Date().toISOString(),
            checkedSessions: sessions.length,
            ...results
        });

    } catch (error: any) {
        console.error('[Reminder Cron Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
