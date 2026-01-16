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

        let mergedIds: number[] = [];
        let originalId = -1;

        if (users.length === 0) {
            return NextResponse.json({ message: '사용자를 찾을 수 없음' });
        }

        if (users.length >= 2) {
            const original = users[0];
            const duplicates = users.slice(1);
            originalId = original.id;

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
                mergedIds.push(dup.id);
            }

            // 4. 원본 유저 정보 정규화
            await query(`UPDATE users SET phone = $1 WHERE id = $2`, [PHONE, original.id]);
        } else {
            // 중복이 없어도 원본 ID는 확보
            originalId = users[0].id;
        }

        // 5. 날짜 수정 로직 (이번 주 일요일(18일) -> 다음 주 일요일(25일)로 변경)
        // 1월 20일 이전에 시작하는 세션이 있다면 7일 미룸
        const dateFixRes = await query(`
            UPDATE sessions
            SET start_date = start_date + INTERVAL '7 days',
                end_date = end_date + INTERVAL '7 days'
            WHERE user_id = $1 
            AND start_date < '2026-01-20'
            RETURNING id, start_date
        `, [originalId]);

        return NextResponse.json({
            success: true,
            merged_to: originalId,
            deleted: mergedIds,
            date_fixed: dateFixRes.rows
        });

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
