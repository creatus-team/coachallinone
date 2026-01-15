import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: 수강생 메모 조회
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const res = await query(`
            SELECT * FROM user_memos 
            WHERE user_id = $1 
            ORDER BY updated_at DESC
        `, [id]);

        return NextResponse.json({ success: true, memos: res.rows });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: 메모 추가/수정 (Upsert)
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const { content } = await request.json();

        // 기존 메모 있으면 업데이트, 없으면 생성
        const existing = await query(`SELECT id FROM user_memos WHERE user_id = $1 LIMIT 1`, [id]);

        let res;
        if (existing.rows.length > 0) {
            res = await query(`
                UPDATE user_memos 
                SET content = $2, updated_at = NOW() 
                WHERE user_id = $1 
                RETURNING *
            `, [id, content]);
        } else {
            res = await query(`
                INSERT INTO user_memos (user_id, content)
                VALUES ($1, $2)
                RETURNING *
            `, [id, content]);
        }

        return NextResponse.json({ success: true, memo: res.rows[0] });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
