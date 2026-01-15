const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    try {
        console.log('🔍 Inspecting Recent Raw Webhooks...');
        const res = await pool.query(`
            SELECT id, created_at, source, status, payload 
            FROM raw_webhooks 
            ORDER BY id DESC 
            LIMIT 10
        `);

        console.table(res.rows.map(r => ({
            id: r.id,
            created_at: r.created_at,
            source: r.source,
            status: r.status,
            name: r.payload?.payment?.name || 'N/A'
        })));

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
inspect();
