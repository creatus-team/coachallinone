const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function run() {
    try {
        await client.connect();
        console.log('Connected to DB');

        await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          action_type VARCHAR(50) NOT NULL,
          old_value TEXT,
          new_value TEXT,
          reason TEXT,
          created_at TIMESTAMP DEFAULT NOW()
      );
    `);
        console.log('Checked/Created user_activity_logs');

        await client.query(`CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);`);
        console.log('Checked/Created index');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await client.end();
    }
}

run();
