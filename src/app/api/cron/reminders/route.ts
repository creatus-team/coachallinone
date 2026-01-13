import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { format, addDays, subDays, isSameDay, parseISO, getDay } from 'date-fns';
import { ko } from 'date-fns/locale';

// Day mapping: 일(0), 월(1), 화(2), 수(3), 목(4), 금(5), 토(6)
const DAY_MAP: Record<string, number> = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6
};

// Convert day_of_week (월, 화...) to next occurrence date
function getNextSessionDate(dayOfWeek: string, fromDate: Date = new Date()): Date {
    const targetDay = DAY_MAP[dayOfWeek];
    if (targetDay === undefined) return fromDate;

    const currentDay = getDay(fromDate);
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7; // Next week if today or past

    return addDays(fromDate, daysUntil);
}

// Check if we should send reminder (D-2 or D-1)
function shouldSendReminder(sessionDate: Date, reminderType: 'D-2' | 'D-1'): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = reminderType === 'D-2'
        ? subDays(sessionDate, 2)
        : subDays(sessionDate, 1);
    targetDate.setHours(0, 0, 0, 0);

    return isSameDay(today, targetDate);
}

export async function GET(request: Request) {
    // Verify cron secret (optional security)
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Allow manual trigger for testing
    const isManual = searchParams.get('manual') === 'true';

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
            const sessionDate = getNextSessionDate(session.day_of_week);
            const sessionDateStr = format(sessionDate, 'M/d(E)', { locale: ko });

            // Check D-2
            if (shouldSendReminder(sessionDate, 'D-2')) {
                // Send to Coach
                try {
                    await sendSMS({
                        to: session.coach_phone,
                        text: `[크리투스 D-2] ${session.user_name}님 수업 예정\n📅 ${sessionDateStr} ${session.start_time}\n수업 준비 부탁드려요!`,
                        type: 'D-2',
                        recipientName: session.coach_name,
                    });
                    results.sent.push(`D-2 코치: ${session.coach_name} (${session.user_name})`);
                } catch (e: any) {
                    results.errors.push(`D-2 코치 실패: ${session.coach_name} - ${e.message}`);
                }

                // Send to Student
                try {
                    await sendSMS({
                        to: session.user_phone,
                        text: `[크리투스 D-2] ${sessionDateStr} ${session.start_time} 수업 예정\n담당: ${session.coach_name} 코치님\n궁금한 점 미리 정리해 주세요! 💪`,
                        type: 'D-2',
                        recipientName: session.user_name,
                    });
                    results.sent.push(`D-2 수강생: ${session.user_name}`);
                } catch (e: any) {
                    results.errors.push(`D-2 수강생 실패: ${session.user_name} - ${e.message}`);
                }
            }

            // Check D-1
            if (shouldSendReminder(sessionDate, 'D-1')) {
                // Send to Coach
                try {
                    await sendSMS({
                        to: session.coach_phone,
                        text: `[크리투스 D-1] 내일 ${session.user_name}님 수업!\n📅 ${sessionDateStr} ${session.start_time}\n준비 완료하셨나요? 🔥`,
                        type: 'D-1',
                        recipientName: session.coach_name,
                    });
                    results.sent.push(`D-1 코치: ${session.coach_name} (${session.user_name})`);
                } catch (e: any) {
                    results.errors.push(`D-1 코치 실패: ${session.coach_name} - ${e.message}`);
                }

                // Send to Student
                try {
                    await sendSMS({
                        to: session.user_phone,
                        text: `[크리투스 D-1] 내일 수업!\n📅 ${sessionDateStr} ${session.start_time}\n${session.coach_name} 코치님과 만나요! 🎯`,
                        type: 'D-1',
                        recipientName: session.user_name,
                    });
                    results.sent.push(`D-1 수강생: ${session.user_name}`);
                } catch (e: any) {
                    results.errors.push(`D-1 수강생 실패: ${session.user_name} - ${e.message}`);
                }
            }
        }

        console.log('[Reminder Cron] Results:', results);

        return NextResponse.json({
            success: true,
            checkedSessions: sessions.length,
            ...results
        });

    } catch (error: any) {
        console.error('[Reminder Cron Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
