import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        // 전체 카운트 조회
        const countRes = await query(`SELECT COUNT(*) as total FROM raw_webhooks`);
        const total = parseInt(countRes.rows[0].total);

        // 데이터 조회 (최신순)
        const res = await query(`
            SELECT id, source, payload, status, error_log, created_at, processed_at
            FROM raw_webhooks 
            ORDER BY created_at DESC 
            LIMIT $1 OFFSET $2
        `, [limit, offset]);

        return NextResponse.json({
            data: res.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error: any) {
        console.error('[API Webhooks Raw Error]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
