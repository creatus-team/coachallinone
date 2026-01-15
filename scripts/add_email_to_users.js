const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('🚀 Adding email column to users table...');

        // 1. Check if column exists
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'email'
        `);

        if (res.rows.length === 0) {
            // 2. Add column
            await pool.query(`ALTER TABLE users ADD COLUMN email VARCHAR(255)`);
            console.log('✅ Added email column');
        } else {
            console.log('ℹ️ Email column already exists');
        }

    } catch (e) {
        console.error('❌ Migration failed:', e);
    } finally {
        pool.end();
    }
}

migrate();
