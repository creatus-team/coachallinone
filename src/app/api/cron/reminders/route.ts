import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { addDays, getDay, differenceInDays } from 'date-fns';

// 코칭신청서 링크
const SURVEY_LINK = 'https://tally.so/r/81qKPr';

// 발송 허용 시간대 (오전 9시 ~ 오후 9시)
const SEND_START_HOUR = 9;
const SEND_END_HOUR = 21;

const DAY_MAP: Record<string, number> = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
};

const DAY_NAME: Record<string, string> = {
    '월': '월요일', '화': '화요일', '수': '수요일', '목': '목요일',
    '금': '금요일', '토': '토요일', '일': '일요일'
};

// Calculate next session date
function getNextSessionDate(dayOfWeek: string, timeStr: string, fromDate: Date = new Date()): Date {
    const targetDay = DAY_MAP[dayOfWeek];
    if (targetDay === undefined) return fromDate;

    const currentDay = getDay(fromDate);
    let daysUntil = targetDay - currentDay;

    if (daysUntil === 0) {
        const [h, m] = timeStr.split(':').map(Number);
        if (fromDate.getHours() > h || (fromDate.getHours() === h && fromDate.getMinutes() >= m)) {
            daysUntil = 7;
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

// Calculate current week number (1주차, 2주차...)
function getCurrentWeek(startDate: Date): number {
    const now = new Date();
    const daysDiff = differenceInDays(now, startDate);
    return Math.floor(daysDiff / 7) + 1;
}

export async function GET(request: Request) {
    try {
        const now = new Date();
        const currentHour = now.getHours();

        // 🔒 시간대 체크: 9시~21시 사이에만 발송
        if (currentHour < SEND_START_HOUR || currentHour >= SEND_END_HOUR) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: `발송 시간대 외 (현재: ${currentHour}시, 허용: ${SEND_START_HOUR}~${SEND_END_HOUR}시)`,
                timestamp: now.toISOString()
            });
        }

        // 🔄 상태 자동 업데이트: pending → active (첫 수업일 도래 시)
        const statusUpdateRes = await query(`
            UPDATE users SET status = 'active'
            WHERE id IN (
                SELECT u.id FROM users u
                JOIN sessions s ON u.id = s.user_id
                WHERE u.status = 'pending' 
                  AND s.start_date <= CURRENT_DATE
                  AND s.end_date >= CURRENT_DATE
            )
            RETURNING id, name
        `);

        const activatedUsers = statusUpdateRes.rows;
        if (activatedUsers.length > 0) {
            console.log('[Status Auto-Update] pending → active:', activatedUsers.map(u => u.name));
        }

        // Get all active sessions with user and coach info
        // ✅ 수정: pending과 active 모두 포함 (pending은 첫 수업일 전이지만 리마인더 필요)
        const sessionsRes = await query(`
      SELECT 
        s.*, 
        u.name as user_name, u.phone as user_phone, u.status as user_status,
        c.name as coach_name, c.phone as coach_phone,
        s.is_renewal
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      JOIN coaches c ON s.coach_id = c.id
      WHERE u.status IN ('active', 'pending')
        AND s.end_date >= CURRENT_DATE
    `);

        const sessions = sessionsRes.rows;
        const results = {
            sent: [] as string[],
            skipped: [] as string[],
            errors: [] as string[],
            statusUpdated: activatedUsers.map(u => u.name)
        };

        for (const session of sessions) {
            const sessionDate = getNextSessionDate(session.day_of_week, session.start_time);
            const diffHours = getHoursUntilSession(sessionDate);
            const dayStr = DAY_NAME[session.day_of_week] || session.day_of_week;

            // 📅 현재 주차 계산
            const currentWeek = getCurrentWeek(new Date(session.start_date));

            // 📋 발송 조건: 2주차부터 (재결제는 1주차부터)
            const minWeek = session.is_renewal ? 1 : 2;
            if (currentWeek < minWeek) {
                results.skipped.push(`${session.user_name}: ${currentWeek}주차 (${minWeek}주차부터 발송)`);
                continue;
            }

            // ===== D-2 (48시간 전 알림) =====
            if (diffHours >= 46 && diffHours <= 50) {
                try {
                    const msg = `[크리투스 코칭신청 리마인드]\n\n${session.user_name}님, 모레(${dayStr}) 코칭 48시간 전입니다.\n만약 아직 작성 전이라면 반드시 "지금" 코칭신청서를 작성해주세요.\n👉 ${SURVEY_LINK}`;

                    await sendSMS({
                        to: session.user_phone,
                        text: msg,
                        type: 'D-2',
                        recipientName: session.user_name,
                    });
                    results.sent.push(`D-2: ${session.user_name} (${currentWeek}주차, ${diffHours.toFixed(0)}시간 전)`);
                } catch (e: any) {
                    results.errors.push(`D-2 실패: ${session.user_name} - ${e.message}`);
                }
            }

            // ===== D-1 (30시간 전 마감임박 알림) =====
            else if (diffHours >= 28 && diffHours <= 32) {
                try {
                    const msg = `[크리투스 코칭신청 리마인드]\n\n${session.user_name}님, 코칭 30시간 전 입니다! 만약 아직 작성 전이라면 반드시 "지금" 코칭신청서를 작성해주세요.\n👉 ${SURVEY_LINK}\n\n(코칭 24시간 이내 미접수 시 대체 코칭 진행)`;

                    await sendSMS({
                        to: session.user_phone,
                        text: msg,
                        type: 'D-1',
                        recipientName: session.user_name,
                    });
                    results.sent.push(`D-1: ${session.user_name} (${currentWeek}주차, ${diffHours.toFixed(0)}시간 전)`);
                } catch (e: any) {
                    results.errors.push(`D-1 실패: ${session.user_name} - ${e.message}`);
                }
            }

            else {
                results.skipped.push(`${session.user_name}: ${diffHours.toFixed(0)}시간 후 수업`);
            }
        }

        console.log('[Reminder Cron] Results:', results);

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            currentHour,
            checkedSessions: sessions.length,
            ...results
        });

    } catch (error: any) {
        console.error('[Reminder Cron Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
