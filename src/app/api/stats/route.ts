import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        // 1. 전체 수강생 통계
        const userStatsRes = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM users
    `);
        const userStats = userStatsRes.rows[0];

        // 2. 코치별 점유율 및 가동률
        // CoachSlots: 전체 슬롯 수 vs 사용 중인 슬롯 수
        const coachStatsRes = await query(`
      SELECT 
        c.name,
        COUNT(cs.id) as total_slots,
        COUNT(CASE WHEN cs.is_available = false THEN 1 END) as used_slots
      FROM coaches c
      LEFT JOIN coach_slots cs ON c.id = cs.coach_id
      GROUP BY c.id, c.name
      ORDER BY used_slots DESC
    `);

        // 3. 이번 달 신규 등록 vs 재결제
        // sessions 테이블의 start_date 기준 이번 달
        const monthlyStatsRes = await query(`
      SELECT 
        COUNT(CASE WHEN is_renewal = false THEN 1 END) as new_enrollments,
        COUNT(CASE WHEN is_renewal = true THEN 1 END) as renewals
      FROM sessions
      WHERE date_trunc('month', start_date) = date_trunc('month', CURRENT_DATE)
    `);
        const monthlyStats = monthlyStatsRes.rows[0];

        return NextResponse.json({
            users: {
                total: parseInt(userStats.total),
                active: parseInt(userStats.active),
                pending: parseInt(userStats.pending),
                completed: parseInt(userStats.completed),
            },
            coaches: coachStatsRes.rows.map(row => ({
                name: row.name,
                totalSlots: parseInt(row.total_slots),
                usedSlots: parseInt(row.used_slots),
                utilizationRate: parseInt(row.total_slots) > 0
                    ? Math.round((parseInt(row.used_slots) / parseInt(row.total_slots)) * 100)
                    : 0
            })),
            monthly: {
                new: parseInt(monthlyStats.new_enrollments),
                renewal: parseInt(monthlyStats.renewals)
            }
        });

    } catch (error: any) {
        console.error('[Stats API Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
