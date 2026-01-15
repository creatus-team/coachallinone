import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit') || '50';

        const result = await query(`
            SELECT id, source, payload, status, error_log, created_at, processed_at
            FROM raw_webhooks 
            WHERE source = 'google_sheet' OR source = 'rapid'
            ORDER BY created_at DESC 
            LIMIT $1
        `, [limit]);

        return NextResponse.json({ logs: result.rows });
    } catch (error) {
        console.error('Failed to fetch logs:', error);
        return NextResponse.json({ error: 'DB Error' }, { status: 500 });
    }
}
