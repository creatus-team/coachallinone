import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: 코치 목록 조회
export async function GET() {
    try {
        const res = await query(`
      SELECT c.*, 
        COUNT(cs.id) FILTER (WHERE cs.is_available = true) as available_slots,
        COUNT(cs.id) as total_slots
      FROM coaches c
      LEFT JOIN coach_slots cs ON c.id = cs.coach_id
      GROUP BY c.id
      ORDER BY c.name
    `);
        return NextResponse.json({ success: true, coaches: res.rows });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: 코치 추가
export async function POST(request: Request) {
    try {
        const { name, phone, openChatLink } = await request.json();

        if (!name || !phone) {
            return NextResponse.json({ success: false, error: '이름과 전화번호는 필수입니다' }, { status: 400 });
        }

        const res = await query(`
      INSERT INTO coaches (name, phone, open_chat_link)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, phone, openChatLink || null]);

        return NextResponse.json({ success: true, coach: res.rows[0] });
    } catch (error: any) {
        if (error.code === '23505') {
            return NextResponse.json({ success: false, error: '이미 등록된 코치입니다' }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT: 코치 수정
export async function PUT(request: Request) {
    try {
        const { id, name, phone, openChatLink } = await request.json();

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID가 필요합니다' }, { status: 400 });
        }

        const res = await query(`
      UPDATE coaches 
      SET name = COALESCE($2, name), 
          phone = COALESCE($3, phone), 
          open_chat_link = $4
      WHERE id = $1
      RETURNING *
    `, [id, name, phone, openChatLink]);

        if (res.rows.length === 0) {
            return NextResponse.json({ success: false, error: '코치를 찾을 수 없습니다' }, { status: 404 });
        }

        return NextResponse.json({ success: true, coach: res.rows[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE: 코치 삭제
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID가 필요합니다' }, { status: 400 });
        }

        // First delete associated slots
        await query('DELETE FROM coach_slots WHERE coach_id = $1', [id]);

        // Then delete the coach
        const res = await query('DELETE FROM coaches WHERE id = $1 RETURNING *', [id]);

        if (res.rows.length === 0) {
            return NextResponse.json({ success: false, error: '코치를 찾을 수 없습니다' }, { status: 404 });
        }

        return NextResponse.json({ success: true, deleted: res.rows[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
