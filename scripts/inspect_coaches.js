const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        const res = await pool.query('SELECT id, name, status FROM coaches');
        console.log('Coaches found:', res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
