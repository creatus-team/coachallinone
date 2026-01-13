require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function seed() {
    try {
        await client.connect();
        console.log('Seeding data...');

        // 1. Add Coaches (simple insert, ignore duplicates)
        const coaches = [
            { name: '김원민', phone: '01012345678', link: 'https://open.kakao.com/o/example1' },
            { name: '이수진', phone: '01087654321', link: 'https://open.kakao.com/o/example2' },
            { name: '박지훈', phone: '01011112222', link: 'https://open.kakao.com/o/example3' },
        ];

        for (const c of coaches) {
            // Check if exists
            const exists = await client.query('SELECT id FROM coaches WHERE name = $1', [c.name]);
            if (exists.rows.length === 0) {
                await client.query(`
          INSERT INTO coaches (name, phone, open_chat_link)
          VALUES ($1, $2, $3)
        `, [c.name, c.phone, c.link]);
                console.log(`  ✅ Coach added: ${c.name}`);
            } else {
                await client.query(`UPDATE coaches SET phone = $1, open_chat_link = $2 WHERE name = $3`, [c.phone, c.link, c.name]);
                console.log(`  ♻️ Coach updated: ${c.name}`);
            }
        }

        // 2. Add Coach Slots (김원민: 3 slots, 이수진: 2 slots)
        const slots = [
            { coach: '김원민', day: '월', time: '14:00' },
            { coach: '김원민', day: '화', time: '16:00' },
            { coach: '김원민', day: '목', time: '10:00' },
            { coach: '이수진', day: '수', time: '15:00' },
            { coach: '이수진', day: '금', time: '11:00' },
        ];

        for (const s of slots) {
            const coachRes = await client.query('SELECT id FROM coaches WHERE name = $1', [s.coach]);
            if (coachRes.rows.length > 0) {
                const coachId = coachRes.rows[0].id;
                await client.query(`
          INSERT INTO coach_slots (coach_id, day_of_week, start_time, is_available)
          VALUES ($1, $2, $3, true)
          ON CONFLICT (coach_id, day_of_week, start_time) DO NOTHING
        `, [coachId, s.day, s.time]);
                console.log(`  ✅ Slot: ${s.coach} ${s.day} ${s.time}`);
            }
        }

        console.log('✅ Seed completed!');
    } catch (e) {
        console.error('❌ Seed error:', e);
    } finally {
        await client.end();
    }
}

seed();
