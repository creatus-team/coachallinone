import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: 슬롯 목록 조회 (특정 코치 또는 전체)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const coachId = searchParams.get('coachId');

        let sql = `
      SELECT 
        cs.*, 
        c.name as coach_name,
        u.name as assigned_user_name,
        s.end_date as session_end_date
      FROM coach_slots cs
      JOIN coaches c ON cs.coach_id = c.id
      LEFT JOIN users u ON cs.assigned_user_id = u.id
      LEFT JOIN sessions s ON s.user_id = u.id AND s.coach_id = cs.coach_id AND s.day_of_week = cs.day_of_week
    `;
        const params: any[] = [];

        if (coachId) {
            sql += ' WHERE cs.coach_id = $1';
            params.push(coachId);
        }
        sql += ' ORDER BY c.name, cs.day_of_week, cs.start_time';

        const res = await query(sql, params);
        return NextResponse.json({ success: true, slots: res.rows });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: 슬롯 추가
export async function POST(request: Request) {
    try {
        const { coachId, dayOfWeek, startTime } = await request.json();

        if (!coachId || !dayOfWeek || !startTime) {
            return NextResponse.json({ success: false, error: '코치, 요일, 시간은 필수입니다' }, { status: 400 });
        }

        const res = await query(`
      INSERT INTO coach_slots (coach_id, day_of_week, start_time, is_available)
      VALUES ($1, $2, $3, true)
      RETURNING *
    `, [coachId, dayOfWeek, startTime]);

        return NextResponse.json({ success: true, slot: res.rows[0] });
    } catch (error: any) {
        if (error.code === '23505') {
            return NextResponse.json({ success: false, error: '이미 등록된 슬롯입니다' }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT: 슬롯 상태 변경
export async function PUT(request: Request) {
    try {
        const { id, isAvailable } = await request.json();

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID가 필요합니다' }, { status: 400 });
        }

        const res = await query(`
      UPDATE coach_slots 
      SET is_available = $2, assigned_user_id = CASE WHEN $2 = true THEN NULL ELSE assigned_user_id END
      WHERE id = $1
      RETURNING *
    `, [id, isAvailable]);

        if (res.rows.length === 0) {
            return NextResponse.json({ success: false, error: '슬롯을 찾을 수 없습니다' }, { status: 404 });
        }

        return NextResponse.json({ success: true, slot: res.rows[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE: 슬롯 삭제
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID가 필요합니다' }, { status: 400 });
        }

        const res = await query('DELETE FROM coach_slots WHERE id = $1 RETURNING *', [id]);

        if (res.rows.length === 0) {
            return NextResponse.json({ success: false, error: '슬롯을 찾을 수 없습니다' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deleted: res.rows[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
