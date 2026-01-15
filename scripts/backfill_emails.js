const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const BACKFILL_DATA = [
    { name: '박지인', email: 'awsmyaksa@gmail.com' },
    { name: '엄나연', email: 'yoniverse52@gmail.com' },
    { name: '김지유', email: 'jiyoo1224@naver.com' }
];

async function backfill() {
    try {
        console.log('🚀 Backfilling emails...');

        for (const item of BACKFILL_DATA) {
            const res = await pool.query(`
                UPDATE users 
                SET email = $1 
                WHERE name = $2 
                RETURNING id, name, email
            `, [item.email, item.name]);

            if (res.rows.length > 0) {
                console.log(`✅ Updated: ${item.name} -> ${item.email}`);
            } else {
                console.log(`⚠️ User not found: ${item.name}`);
            }
        }

        // Raw Data도 업데이트 (나중에 뷰어에서 확인 위해)
        // 기존 Raw Data에는 payload 내부에 이메일이 없지만, 
        // 뷰어는 payload에서 읽으므로, raw_webhooks의 payload를 업데이트해야 뷰어에서 보임.
        // 하지만 payload는 jsonb이므로 부분 업데이트가 까다로움.
        // 이번 케이스는 '시스템 사용자' 정보를 채우는게 핵심이므로 users 테이블만 업데이트해도 됨.
        // 다만 뷰어에서 바로 보고 싶다면, raw_webhooks도 건드려야 함.
        // 여기서는 users 테이블만 업데이트하고, 뷰어는 '새로 들어오는 데이터'부터 이메일이 보임.
        // (기존 데이터 복구분은 뷰어에서 안보일 수 있음 -> 해결책: raw_webhooks도 업데이트)

        console.log('\n🔄 Updating raw_webhooks payloads (Optional)...');
        // 복구 스크립트로 넣었던 데이터 찾기 (source = 'manual_recovery')
        const rawRes = await pool.query(`
            SELECT id, payload FROM raw_webhooks WHERE source = 'manual_recovery'
        `);

        for (const row of rawRes.rows) {
            const payload = row.payload;
            const name = payload.payment?.name;

            const match = BACKFILL_DATA.find(d => d.name === name);
            if (match) {
                payload.payment.buyer_email = match.email;

                await pool.query(`
                    UPDATE raw_webhooks 
                    SET payload = $1 
                    WHERE id = $2
                `, [payload, row.id]);
                console.log(`✅ Raw Payload Updated: ${name}`);
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

backfill();
