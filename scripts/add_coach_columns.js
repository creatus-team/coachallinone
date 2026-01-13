const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function addCoachColumns() {
    try {
        console.log('Adding coach columns...');
        
        await pool.query(`
            ALTER TABLE coaches ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT '활동';
        `);
        console.log('✅ status column added');
        
        await pool.query(`
            ALTER TABLE coaches ADD COLUMN IF NOT EXISTS start_date DATE;
        `);
        console.log('✅ start_date column added');
        
        await pool.query(`
            ALTER TABLE coaches ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT '정식코치';
        `);
        console.log('✅ tier column added');
        
        console.log('\n✅ All columns added successfully!');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await pool.end();
    }
}

addCoachColumns();
