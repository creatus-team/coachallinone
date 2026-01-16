import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const PHONE = '01053070228';

        // 1. 해당 번호의 모든 유저 조회 (생성일 순)
        const res = await query(`
            SELECT id, name, phone, created_at 
            FROM users 
            WHERE replace(phone, '-', '') = $1 
            ORDER BY created_at ASC
        `, [PHONE]);

        const users = res.rows;
        if (users.length < 2) {
            return NextResponse.json({ message: '중복 유저가 없거나 이미 해결됨', users });
        }

        const original = users[0];
        const duplicates = users.slice(1);

        console.log(`[Fix] Merging ${duplicates.length} users into ID ${original.id}`);

        for (const dup of duplicates) {
            // 2. 세션 이동
            await query(`
                UPDATE sessions 
                SET user_id = $1 
                WHERE user_id = $2
            `, [original.id, dup.id]);

            // 3. 중복 유저 삭제
            await query(`DELETE FROM users WHERE id = $1`, [dup.id]);
        }

        // 4. 원본 유저 정보 정규화 (선택)
        await query(`UPDATE users SET phone = $1 WHERE id = $2`, [PHONE, original.id]);

        return NextResponse.json({
            success: true,
            merged_to: original.id,
            deleted: duplicates.map(u => u.id)
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
