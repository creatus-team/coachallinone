const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrate() {
    try {
        console.log('Creating raw_webhooks table...');

        await pool.query(`
      CREATE TABLE IF NOT EXISTS raw_webhooks (
        id SERIAL PRIMARY KEY,
        source VARCHAR(50) NOT NULL,
        payload JSONB NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING',
        error_log TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE
      );
    `);

        console.log('✅ raw_webhooks table created successfully');

        // 인덱스 생성 (조회 성능 향상)
        await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_webhooks_status ON raw_webhooks(status);
      CREATE INDEX IF NOT EXISTS idx_raw_webhooks_created_at ON raw_webhooks(created_at);
    `);

        console.log('✅ Indexes created successfully');

    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await pool.end();
    }
}

migrate();
