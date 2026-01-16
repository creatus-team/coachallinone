import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        await query(`
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
        await query(`CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);`);

        return NextResponse.json({ success: true, message: 'Migration executed: user_activity_logs table created' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
