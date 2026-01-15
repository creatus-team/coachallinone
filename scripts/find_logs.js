const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function findLogs() {
    try {
        console.log('🔍 Searching logs for "김지유"...');
        const res = await pool.query(`
            SELECT id, type, content, status, sent_at 
            FROM message_logs 
            WHERE content LIKE '%김지유%' 
               OR recipient_name = '김지유'
            ORDER BY sent_at ASC
        `);

        if (res.rows.length === 0) {
            console.log('❌ No logs found.');
        } else {
            console.log(`✅ Found ${res.rows.length} logs:`);
            res.rows.forEach(row => {
                console.log(`[${row.sent_at}] [${row.type}] ${row.content}`);
                console.log('---');
            });
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
findLogs();
