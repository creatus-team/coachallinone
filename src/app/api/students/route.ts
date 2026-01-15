import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: 수강생 목록 조회 (확장된 정보 포함)
export async function GET() {
    try {
        const res = await query(`
            SELECT 
                u.*,
                s.id as session_id,
                s.coach_id,
                c.name as coach_name,
                s.day_of_week,
                s.start_time,
                s.start_date,
                s.end_date,
                COALESCE(s.extension_count, 0) as extension_count,
                (SELECT MIN(start_date) FROM sessions WHERE user_id = u.id) as first_start_date,
                (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as total_sessions,
                EXTISTS(SELECT 1 FROM user_memos WHERE user_id = u.id AND content != '') as has_memo
            FROM users u
            LEFT JOIN sessions s ON u.id = s.user_id 
                AND s.id = (SELECT id FROM sessions WHERE user_id = u.id ORDER BY end_date DESC LIMIT 1)
            LEFT JOIN coaches c ON s.coach_id = c.id
            ORDER BY u.created_at DESC
        `);
        return NextResponse.json({ success: true, students: res.rows });
    } catch (error: any) {
        console.error('Students API Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT: 수강생 상태 수정
export async function PUT(request: Request) {
    try {
        const { id, name, phone, status, productType } = await request.json();

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID가 필요합니다' }, { status: 400 });
        }

        const res = await query(`
      UPDATE users 
      SET name = COALESCE($2, name), 
          phone = COALESCE($3, phone), 
          status = COALESCE($4, status),
          product_type = COALESCE($5, product_type)
      WHERE id = $1
      RETURNING *
    `, [id, name, phone, status, productType]);

        if (res.rows.length === 0) {
            return NextResponse.json({ success: false, error: '수강생을 찾을 수 없습니다' }, { status: 404 });
        }

        return NextResponse.json({ success: true, student: res.rows[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE: 수강생 삭제
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID가 필요합니다' }, { status: 400 });
        }

        await query('DELETE FROM sessions WHERE user_id = $1', [id]);
        await query('UPDATE coach_slots SET is_available = true, assigned_user_id = NULL WHERE assigned_user_id = $1', [id]);
        const res = await query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);

        if (res.rows.length === 0) {
            return NextResponse.json({ success: false, error: '수강생을 찾을 수 없습니다' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deleted: res.rows[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
