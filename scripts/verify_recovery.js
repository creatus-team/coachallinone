const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function verify() {
    try {
        console.log('Checking recovered users...');
        const res = await pool.query(`
            SELECT name, phone, product_type, created_at 
            FROM users 
            WHERE name IN ('박지인', '엄나연', '김지유')
            ORDER BY created_at DESC
        `);
        console.table(res.rows);

        console.log('\nChecking active sessions...');
        const sessions = await pool.query(`
            SELECT u.name, c.name as coach_name, s.day_of_week, s.start_time
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            JOIN coaches c ON s.coach_id = c.id
            WHERE u.name IN ('박지인', '엄나연', '김지유')
        `);
        console.table(sessions.rows);

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
verify();
