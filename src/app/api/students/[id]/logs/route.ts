import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: 수강생 활동 로그 조회
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const res = await query(`
            SELECT * FROM user_activity_logs 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [id]);

        return NextResponse.json({ success: true, logs: res.rows });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: 활동 로그 추가
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const { actionType, oldValue, newValue, reason } = await request.json();

        const res = await query(`
            INSERT INTO user_activity_logs (user_id, action_type, old_value, new_value, reason)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [id, actionType, oldValue, newValue, reason]);

        return NextResponse.json({ success: true, log: res.rows[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
