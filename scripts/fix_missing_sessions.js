const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const { addWeeks } = require('date-fns');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fix() {
    try {
        console.log('Scanning for active users without sessions...');

        // Find active users with no sessions
        const res = await pool.query(`
      SELECT u.id, u.name, u.created_at 
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id
      WHERE u.status = 'active' AND s.id IS NULL
    `);

        if (res.rows.length === 0) {
            console.log('All active users have sessions. No action needed.');
            return;
        }

        console.log(`Found ${res.rows.length} users with missing sessions.`);

        // Find a default coach to assign (just the first one)
        const coachRes = await pool.query('SELECT id FROM coaches LIMIT 1');
        const coachId = coachRes.rows[0]?.id;

        if (!coachId) {
            console.error('No coaches found to assign!');
            return;
        }

        for (const user of res.rows) {
            const startDate = new Date(user.created_at);
            const endDate = addWeeks(startDate, 4); // Default 4 weeks

            console.log(`Fixing User: ${user.name} (ID: ${user.id})`);
            console.log(`- Creating session: ${startDate.toISOString()} ~ ${endDate.toISOString()}`);

            await pool.query(`
        INSERT INTO sessions (user_id, coach_id, day_of_week, start_time, start_date, end_date, is_renewal)
        VALUES ($1, $2, '월', '10:00', $3, $4, false)
      `, [user.id, coachId, startDate, endDate]);

            console.log('  Done.');
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

fix();
