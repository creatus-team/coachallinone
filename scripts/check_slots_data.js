const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function check() {
    try {
        console.log('🔍 Checking Coaches & Slots...');

        // 1. Check Coaches
        const coaches = await pool.query('SELECT id, name FROM coaches');
        console.log(`\n👨‍🏫 Found ${coaches.rows.length} Coaches:`);
        console.table(coaches.rows);

        if (coaches.rows.length > 0) {
            // 2. Check Slots for first coach
            const firstCoachId = coaches.rows[0].id;
            const slots = await pool.query('SELECT * FROM coach_slots WHERE coach_id = $1', [firstCoachId]);
            console.log(`\n📅 Slots for coach ${coaches.rows[0].name}:`);
            console.table(slots.rows);
        }
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
check();
