require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Railway often needs this
  },
});

const schema = `
  -- 1. Users (수강생)
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL UNIQUE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, paused
    product_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 2. Coaches (코치)
  CREATE TABLE IF NOT EXISTS coaches (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    specialty VARCHAR(100),
    open_chat_link VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 3. CoachSlots (코치 오픈 슬롯)
  CREATE TABLE IF NOT EXISTS coach_slots (
    id SERIAL PRIMARY KEY,
    coach_id INTEGER REFERENCES coaches(id),
    day_of_week VARCHAR(10) NOT NULL, -- '월', '화'...
    start_time VARCHAR(10) NOT NULL,  -- '14:00'
    is_available BOOLEAN DEFAULT true,
    assigned_user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coach_id, day_of_week, start_time)
  );

  -- 4. Sessions (수업/매칭)
  CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    coach_id INTEGER REFERENCES coaches(id),
    slot_id INTEGER REFERENCES coach_slots(id),
    day_of_week VARCHAR(10),
    start_time VARCHAR(10),
    start_date DATE,
    end_date DATE,
    is_renewal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- 5. MessageLogs (로그)
  CREATE TABLE IF NOT EXISTS message_logs (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50), -- D-2, D-1, NEW, RENEWAL
    recipient_name VARCHAR(50),
    recipient_phone VARCHAR(20),
    content TEXT,
    status VARCHAR(20), -- SENT, FAILED
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;


async function setup() {
  try {
    await client.connect();
    console.log("Creating tables...");
    await client.query(schema);
    console.log("✅ Tables created successfully!");

    // Seed Dummy Data (Optional, for testing)
    // await client.query("INSERT INTO coaches (name, phone) VALUES ('김원민', '01012345678') ON CONFLICT DO NOTHING;");

  } catch (e) {
    console.error("❌ Error creating tables:", e);
  } finally {
    await client.end();
  }
}

setup();
