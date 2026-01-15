const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Correct Data (Amount fixed to 400,000, Emails added)
// Previously 10000, 1528, 2000 were likely Follower Counts.
const CORRECTION_DATA = [
    { name: '박지인', email: 'awsmyaksa@gmail.com', amount: 400000 },
    { name: '엄나연', email: 'yoniverse52@gmail.com', amount: 400000 },
    { name: '김지유', email: 'jiyoo1224@naver.com', amount: 400000 }
];

async function correctAndBackfill() {
    try {
        console.log('🚀 Starting Data Correction & Backfill...');

        for (const item of CORRECTION_DATA) {
            console.log(`\nProcessing: ${item.name}...`);

            // 1. Update Users Table (Backfill Email)
            const userRes = await pool.query(`
                UPDATE users 
                SET email = $1 
                WHERE name = $2 
                RETURNING id, name, email
            `, [item.email, item.name]);

            if (userRes.rows.length > 0) {
                console.log(`✅ User Email Updated: ${item.email}`);
            } else {
                console.log(`⚠️ User not found: ${item.name}`);
            }

            // 2. Update Raw Webhooks (Fix Amount & Add Email)
            // We need to find the raw log for this user.
            const rawRes = await pool.query(`
                SELECT id, payload 
                FROM raw_webhooks 
                WHERE (payload->'payment'->>'name') = $1
                   OR (payload->'payment'->>'clientName') = $1
                ORDER BY id DESC LIMIT 1
            `, [item.name]);

            if (rawRes.rows.length > 0) {
                const row = rawRes.rows[0];
                const payload = row.payload;

                // Update fields
                if (payload.payment) {
                    payload.payment.amount = item.amount;
                    payload.payment.buyer_email = item.email;
                    // Remove erroneous fields if present? No, just update necessary ones.
                }

                await pool.query(`
                    UPDATE raw_webhooks 
                    SET payload = $1 
                    WHERE id = $2
                `, [payload, row.id]);

                console.log(`✅ Raw Payload Corrected: Amount -> ${item.amount}, Email -> ${item.email}`);
            } else {
                console.log(`⚠️ Raw Webhook not found for: ${item.name}`);
            }
        }

    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        pool.end();
    }
}

correctAndBackfill();
