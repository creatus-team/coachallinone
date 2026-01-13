require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

const migrations = `
  -- Add missing columns to coaches
  ALTER TABLE coaches ADD COLUMN IF NOT EXISTS open_chat_link VARCHAR(255);

  -- Add missing columns to users
  ALTER TABLE users ADD COLUMN IF NOT EXISTS product_type VARCHAR(100);

  -- Ensure coach_slots table exists with all columns
  CREATE TABLE IF NOT EXISTS coach_slots (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER REFERENCES coaches(id),
    day_of_week VARCHAR(10) NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    is_available BOOLEAN DEFAULT true,
    assigned_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coach_id, day_of_week, start_time)
  );

  -- Add missing columns to sessions
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS slot_id INTEGER REFERENCES coach_slots(id);
  ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_renewal BOOLEAN DEFAULT false;

  -- Add missing columns to message_logs
  ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(50);
  ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);
`;

async function migrate() {
    try {
        await client.connect();
        console.log('Running migrations...');
        await client.query(migrations);
        console.log('✅ Migrations completed!');
    } catch (e) {
        console.error('❌ Migration error:', e);
    } finally {
        await client.end();
    }
}

migrate();
