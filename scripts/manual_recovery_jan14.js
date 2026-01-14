const { Pool } = require('pg');
const { format, addWeeks, addDays, getDay } = require('date-fns');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const DATA_TO_RECOVER = [
    {
        name: '박지인',
        phone: '010-2907-6490',
        option: '이호현/수요일/22:00~22:40',
        amount: 10000,
        email: 'awsmyaksa@gmail.com'
    },
    {
        name: '엄나연',
        phone: '010-6623-7816',
        option: '이호현/월요일/22:00~22:40',
        amount: 1528, // 원본 그대로
        email: 'yoniverse52@gmail.com'
    },
    {
        name: '김지유',
        phone: '010-7101-6521',
        option: '이호현/일요일/21:00~21:40',
        amount: 2000, // 2.0k -> 2000
        email: 'jiyoo1224@naver.com'
    }
];

// 요일 매핑
const DAY_MAP = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6
};

function getNextWeekDay(fromDate, dayOfWeek) {
    const dayIndex = DAY_MAP[dayOfWeek];
    if (dayIndex === undefined) return addWeeks(fromDate, 1);

    const nextWeekStart = new Date(fromDate);
    nextWeekStart.setDate(fromDate.getDate() + (7 - fromDate.getDay()) + 1); // 다음 주 월요일

    const targetDayOffset = dayIndex === 0 ? 6 : dayIndex - 1;
    const targetDate = new Date(nextWeekStart);
    targetDate.setDate(nextWeekStart.getDate() + targetDayOffset);

    return targetDate;
}

function parseOption(optionStr) {
    if (!optionStr) return null;
    const parts = optionStr.split('/');

    const extractTime = (timeRange) => {
        if (timeRange.includes('~')) return timeRange.split('~')[0].trim();
        if (timeRange.includes('-')) {
            const match = timeRange.match(/^(\d{1,2}:\d{2})/);
            return match ? match[1] : timeRange.trim();
        }
        return timeRange.trim();
    };

    if (parts.length === 3) {
        return {
            coach: parts[0].trim(),
            day: parts[1].trim(),
            time: extractTime(parts[2].trim())
        };
    } else if (parts.length >= 4) {
        return {
            coach: parts[0].trim(),
            day: parts[2].trim(),
            time: extractTime(parts[3].trim())
        };
    }
    return null;
}

function normalizePhone(phone) {
    if (!phone) return '';
    let str = phone.replace(/[^0-9]/g, '');
    if (str.startsWith('82') && str.length > 10) str = '0' + str.slice(2);
    if (str.startsWith('10') && str.length === 10) str = '0' + str;
    return str;
}

async function recover() {
    console.log('🚀 Starting recovery for 3 users...');

    // Simulate current time as when the error happened (approx 18:00) but uses NOW for DB consistency
    // Actually, getNextWeekDay uses TODAY. Today is still Tuesday Jan 14. 
    // Logic should hold fine.

    for (const item of DATA_TO_RECOVER) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            console.log(`\nProcessing: ${item.name} (${item.phone})...`);

            const normalizedPhone = normalizePhone(item.phone);

            // 1. Raw Webhook Insert (Historical Record)
            const payload = {
                payment: {
                    name: item.name,
                    phoneNumber: item.phone,
                    option: item.option,
                    amount: item.amount,
                    status: 'SUCCESS'
                },
                note: 'Manually Recovered'
            };

            await client.query(`
                INSERT INTO raw_webhooks (source, payload, status)
                VALUES ('manual_recovery', $1, 'PROCESSED')
            `, [payload]);
            console.log('✅ Logged to raw_webhooks');

            // 2. Parse Option
            const parsed = parseOption(item.option);
            if (!parsed) {
                console.error(`❌ Parse failed for ${item.option}`);
                await client.query('ROLLBACK');
                continue;
            }

            // 3. Find Coach
            let coachId;
            const coachRes = await client.query(`SELECT id FROM coaches WHERE name = $1`, [parsed.coach]);

            if (coachRes.rows.length === 0) {
                console.log(`⚠️ Coach not found: ${parsed.coach}. Creating placeholder...`);
                const newCoach = await client.query(`
                    INSERT INTO coaches (name, phone, status) 
                    VALUES ($1, '010-0000-0000', '활동')
                    RETURNING id
                 `, [parsed.coach]);
                coachId = newCoach.rows[0].id;
                console.log(`✅ Created placeholder coach (ID: ${coachId})`);
            } else {
                coachId = coachRes.rows[0].id;
            }

            // 4. Calculate Dates
            // Logic: Next Week's Day.
            const today = new Date();
            const firstSessionDate = getNextWeekDay(today, parsed.day);
            const sessionEndDate = addWeeks(firstSessionDate, 3);

            // 5. User Create/Update
            const userRes = await client.query(`
                INSERT INTO users (name, phone, status, product_type)
                VALUES ($1, $2, 'pending', $3)
                ON CONFLICT (phone) DO UPDATE SET
                    name = EXCLUDED.name,
                    status = 'pending',
                    product_type = EXCLUDED.product_type
                RETURNING id
            `, [item.name, normalizedPhone, item.option]);
            const userId = userRes.rows[0].id;
            console.log(`✅ User ensured (ID: ${userId})`);

            // 6. Session Create
            await client.query(`
                INSERT INTO sessions (user_id, coach_id, day_of_week, start_time, start_date, end_date)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [userId, coachId, parsed.day, parsed.time, firstSessionDate, sessionEndDate]);
            console.log(`✅ Session created (${format(firstSessionDate, 'yyyy-MM-dd')} ~ ${format(sessionEndDate, 'yyyy-MM-dd')})`);

            // 7. Update Slot
            await client.query(`
                 UPDATE coach_slots SET is_available = false, assigned_user_id = $1 
                 WHERE coach_id = $2 AND day_of_week = $3 AND start_time = $4
            `, [userId, coachId, parsed.day, parsed.time]);

            // If slot didn't exist, insert (logic from route.ts)
            const checkSlot = await client.query(`
                SELECT id FROM coach_slots 
                WHERE coach_id = $1 AND day_of_week = $2 AND start_time = $3
            `, [coachId, parsed.day, parsed.time]);

            if (checkSlot.rows.length === 0) {
                await client.query(`
                    INSERT INTO coach_slots (coach_id, day_of_week, start_time, is_available, assigned_user_id)
                    VALUES ($1, $2, $3, false, $4)
                `, [coachId, parsed.day, parsed.time, userId]);
                console.log('✅ Slot created');
            } else {
                console.log('✅ Slot updated');
            }

            await client.query('COMMIT');
            console.log(`🎉 Success: ${item.name}`);

        } catch (e) {
            await client.query('ROLLBACK');
            console.error(`❌ Error processing ${item.name}:`, e);
        } finally {
            client.release();
        }
    }
    await pool.end();
}

recover();
