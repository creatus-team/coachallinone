import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: 수강생의 모든 세션 이력 조회
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const res = await query(`
            SELECT 
                s.id,
                s.start_date,
                s.end_date,
                s.day_of_week,
                s.start_time,
                COALESCE(s.extension_count, 0) as extension_count,
                c.name as coach_name
            FROM sessions s
            LEFT JOIN coaches c ON s.coach_id = c.id
            WHERE s.user_id = $1
            ORDER BY s.start_date DESC
        `, [id]);

        return NextResponse.json({ success: true, sessions: res.rows });
    } catch (error: any) {
        console.error('Sessions API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
