import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();

    try {
        // 1. Generate Date Series
        // This creates a row for every day in the range to ensure continuous chart data (filling gaps with 0)
        const dateSeriesQuery = `
      SELECT generate_series($1::date, $2::date, '1 day'::interval)::date as day
    `;

        // 2. New Enrollments & Renewals by Day
        const sessionsQuery = `
      SELECT 
        date_trunc('day', start_date)::date as day,
        COUNT(CASE WHEN is_renewal = false THEN 1 END) as new_count,
        COUNT(CASE WHEN is_renewal = true THEN 1 END) as renewal_count
      FROM sessions
      WHERE start_date >= $1 AND start_date <= $2
      GROUP BY 1
    `;

        // 3. Active Users Snapshot by Day (Complex: Needs to check if user was active on that specific day)
        // For simplicity and performance in MVP, we track 'registrations' vs 'expirations'.
        // Or we can count active sessions where start <= day <= end.
        const activeUsersQuery = `
      SELECT 
        d.day,
        COUNT(s.id) as active_count
      FROM (${dateSeriesQuery}) d
      LEFT JOIN sessions s ON s.start_date <= d.day AND s.end_date >= d.day
      GROUP BY d.day
      ORDER BY d.day
    `;

        // Execute Queries
        const [seriesRes, statsRes, activeRes] = await Promise.all([
            query(dateSeriesQuery, [startDate, endDate]),
            query(sessionsQuery, [startDate, endDate]),
            query(activeUsersQuery, [startDate, endDate])
        ]);

        // Process Data
        const trends = seriesRes.rows.map(row => {
            const dayStr = row.day.toISOString().split('T')[0];

            const stats = statsRes.rows.find(r => r.day.toISOString().split('T')[0] === dayStr) || { new_count: 0, renewal_count: 0 };
            const active = activeRes.rows.find(r => r.day.toISOString().split('T')[0] === dayStr) || { active_count: 0 };

            // Pseudo Retention Rate: Renewals / (New + Renewals) * 100 (Simplified for trend)
            // True retention requires cohort analysis, which is too heavy for now.
            const totalJoin = parseInt(stats.new_count) + parseInt(stats.renewal_count);
            const retentionRate = totalJoin > 0 ? (parseInt(stats.renewal_count) / totalJoin) * 100 : 0;

            return {
                date: dayStr,
                new: parseInt(stats.new_count),
                renewal: parseInt(stats.renewal_count),
                active: parseInt(active.active_count),
                retentionRate: Math.round(retentionRate)
            };
        });

        return NextResponse.json({ trends });

    } catch (error: any) {
        console.error('[Stats Trend & Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
