import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sendSMS } from '@/lib/sms';
import { addDays, format, getDay } from 'date-fns';

// 코칭신청서 DB 링크
const COACHING_FORM_DB = 'https://www.notion.so/loat/DB-2c434088a27d80a9b159cde35db969cf';

// 요일 매핑 (날짜 → 요일 문자열)
const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export async function GET(request: Request) {
    try {
        const now = new Date();
        const tomorrow = addDays(now, 1);
        const tomorrowDayName = DAY_NAMES[getDay(tomorrow)];
        const tomorrowStr = format(tomorrow, 'M/d(E)');

        console.log(`[Coach Schedule Reminder] Checking for ${tomorrowDayName} (${tomorrowStr})`);

        // 내일 수업이 있는 코치들 조회
        const coachesRes = await query(`
            SELECT DISTINCT c.id, c.name, c.phone
            FROM coaches c
            JOIN sessions s ON c.id = s.coach_id
            JOIN users u ON s.user_id = u.id
            WHERE s.day_of_week = $1
              AND s.start_date <= $2
              AND s.end_date >= $2
              AND u.status IN ('active', 'pending')
        `, [tomorrowDayName, tomorrow]);

        const results = {
            sent: [] as string[],
            noSchedule: [] as string[],
            errors: [] as string[]
        };

        // 모든 코치 조회 (스케줄 없는 코치에게도 알림)
        const allCoachesRes = await query(`SELECT id, name, phone FROM coaches WHERE status = '활동'`);

        for (const coach of allCoachesRes.rows) {
            // 해당 코치의 내일 스케줄 조회
            const scheduleRes = await query(`
                SELECT s.start_time, u.name as student_name
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.coach_id = $1
                  AND s.day_of_week = $2
                  AND s.start_date <= $3
                  AND s.end_date >= $3
                  AND u.status IN ('active', 'pending')
                ORDER BY s.start_time
            `, [coach.id, tomorrowDayName, tomorrow]);

            try {
                if (scheduleRes.rows.length === 0) {
                    // 내일 코칭 없음
                    const msg = `${coach.name}코치님! 내일(${tomorrowStr}) 코칭 스케줄이 없습니다.\n\n좋은 하루 보내세요! 😊`;

                    await sendSMS({
                        to: coach.phone,
                        text: msg,
                        type: 'ADMIN',
                        recipientName: coach.name
                    });
                    results.noSchedule.push(coach.name);
                } else {
                    // 스케줄 목록 생성
                    const scheduleList = scheduleRes.rows
                        .map((s: any) => `- ${s.start_time} ${s.student_name}님 코칭`)
                        .join('\n');

                    const msg = `${coach.name}코치님! 내일(${tomorrowStr}) 코칭 스케줄 공유드립니다.\n\n${scheduleList}\n\n제출된 코칭신청서를 읽고 반드시 미리 코칭계획서를 작성해주세요!\n👉 ${COACHING_FORM_DB}`;

                    await sendSMS({
                        to: coach.phone,
                        text: msg,
                        type: 'ADMIN',
                        recipientName: coach.name
                    });
                    results.sent.push(`${coach.name} (${scheduleRes.rows.length}건)`);
                }
            } catch (e: any) {
                results.errors.push(`${coach.name}: ${e.message}`);
            }
        }

        console.log('[Coach Schedule Reminder] Results:', results);

        return NextResponse.json({
            success: true,
            timestamp: now.toISOString(),
            targetDate: tomorrowStr,
            ...results
        });

    } catch (error: any) {
        console.error('[Coach Schedule Reminder Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
