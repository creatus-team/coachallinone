const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function inspect() {
    try {
        console.log('=== Active Users ===');
        const users = await pool.query("SELECT id, name, status, created_at FROM users WHERE status = 'active'");
        console.table(users.rows);

        const userIds = users.rows.map(u => u.id);
        if (userIds.length > 0) {
            console.log('\n=== Sessions for Active Users ===');
            const sessions = await pool.query("SELECT id, user_id, start_date, end_date, is_renewal FROM sessions WHERE user_id = ANY($1)", [userIds]);
            console.table(sessions.rows.map(s => ({
                ...s,
                start_date: new Date(s.start_date).toLocaleString(),
                end_date: new Date(s.end_date).toLocaleString()
            })));
        } else {
            console.log('No active users found.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

inspect();
