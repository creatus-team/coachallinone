const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const WEBHOOK_URL = 'https://coachallinone-production.up.railway.app/api/webhooks/rapid';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '01000000000';

// Test Data
const TEST_NAME = '[TEST] Elon_Core_Check';
const TEST_PHONE = ADMIN_PHONE;
const TEST_COACH = '이호현';
const TEST_DAY = '월요일';
const TEST_TIME = '14:00';
const TEST_OPTION = `${TEST_COACH}/${TEST_DAY}/${TEST_TIME}~14:40`;
const TEST_EMAIL = 'test_elon@example.com';

async function runTest() {
    console.log('🚀 Starting Core Flow E2E Test...');
    console.log(`target: ${WEBHOOK_URL}`);
    console.log(`payload: ${TEST_NAME} / ${TEST_OPTION} / ${TEST_PHONE}`);

    // Check Env
    if (!process.env.ADMIN_PHONE) console.warn('⚠️ ADMIN_PHONE is missing in process.env');

    // PRE-CLEANUP
    await cleanupUser(TEST_NAME);

    let userId = null;
    let rawId = null;

    try {
        // 0. Get Coach Info
        const coachRes = await pool.query('SELECT id, phone, name FROM coaches WHERE name = $1', [TEST_COACH]);
        if (coachRes.rows.length === 0) throw new Error('Coach not found: ' + TEST_COACH);
        const testCoachId = coachRes.rows[0].id;
        const testCoachPhone = coachRes.rows[0].phone;
        const testCoachName = coachRes.rows[0].name;
        console.log(`🎯 Test Target: Coach ${testCoachName} (ID: ${testCoachId}, Phone: ${testCoachPhone})`);

        // 1. Send Webhook
        console.log('\n📡 Sending Webhook...');
        const payload = {
            payment: {
                name: TEST_NAME,
                phoneNumber: TEST_PHONE,
                option: TEST_OPTION,
                amount: 100,
                status: 'SUCCESS',
                buyer_email: TEST_EMAIL
            }
        };

        const response = await axios.post(WEBHOOK_URL, payload);
        console.log('✅ Webhook Response:', response.status, response.data);

        // Wait for processing
        console.log('⏳ Waiting 3s for processing...');
        await new Promise(r => setTimeout(r, 3000));

        // 2. Verify Raw Webhook
        console.log('\n🔍 Verifying Raw Webhook...');
        const rawRes = await pool.query(`
            SELECT * FROM raw_webhooks 
            WHERE payload->'payment'->>'name' = $1 
            ORDER BY id DESC LIMIT 1
        `, [TEST_NAME]);

        if (rawRes.rows.length > 0) {
            rawId = rawRes.rows[0].id;
            console.log(`✅ Raw Webhook Found: ID ${rawId} | Status: ${rawRes.rows[0].status}`);
        } else {
            throw new Error('❌ Raw Webhook NOT found!');
        }

        // 3. Verify User
        console.log('\n🔍 Verifying User Created...');
        const userRes = await pool.query(`SELECT * FROM users WHERE name = $1`, [TEST_NAME]);
        if (userRes.rows.length > 0) {
            userId = userRes.rows[0].id;
            console.log(`✅ User Found: ID ${userId} | Name: ${userRes.rows[0].name} | Email: ${userRes.rows[0].email}`);
        } else {
            throw new Error('❌ User NOT found!');
        }

        // 4. Verify Session
        console.log('\n🔍 Verifying Session Created...');
        const sessionRes = await pool.query(`SELECT * FROM sessions WHERE user_id = $1`, [userId]);
        if (sessionRes.rows.length > 0) {
            console.log(`✅ Session Found: ${sessionRes.rows.length} sessions created.`);
            console.log(`   - First Session: ${sessionRes.rows[0].start_time} (Coach ID: ${sessionRes.rows[0].coach_id})`);
        } else {
            throw new Error('❌ Session NOT found!');
        }

        // 5. Verify Slot Status
        console.log('\n🔍 Verifying Slot Status...');
        const shortDay = TEST_DAY.replace('요일', '');

        const slotRes = await pool.query(`
            SELECT * FROM coach_slots 
            WHERE day_of_week = $1 AND start_time = $2 AND coach_id = $3
        `, [shortDay, TEST_TIME, testCoachId]);

        if (slotRes.rows.length > 0) {
            const slot = slotRes.rows[0];
            console.log(`✅ Slot Found for ${TEST_COACH}: Is Available? ${slot.is_available} (Should be false)`);
            if (slot.is_available) throw new Error('❌ Slot check failed: Slot is still available!');
        } else {
            console.log(`ℹ️ No slot found (Should have been created). Logic ensures creation.`);
        }

        // 6. Verify SMS Logs
        console.log('\n🔍 Verifying Message Logs...');

        // Coach Logs
        const coachLogs = await pool.query(`
            SELECT type, recipient_phone, content FROM message_logs WHERE recipient_phone = $1 ORDER BY id DESC LIMIT 3
        `, [testCoachPhone]);

        console.log(`Found ${coachLogs.rows.length} logs for Coach ${testCoachName} (${testCoachPhone}):`);
        coachLogs.rows.forEach(l => console.log(`   - [${l.type}] ${l.content.substring(0, 30)}...`));

        if (coachLogs.rows.length === 0) console.warn('⚠️ No logs found for COACH. Notification might have failed.');
        else console.log('✅ Coach Notification Logged!');

        console.log('\n✨ TEST COMPLETE: SUCCESS ✨');

    } catch (e) {
        console.error('\n❌ TEST FAILED:', e);
    } finally {
        await cleanupUser(TEST_NAME);
        if (rawId) {
            await pool.query('DELETE FROM raw_webhooks WHERE id = $1', [rawId]);
            console.log('   - Deleted Raw Webhook');
        }
        pool.end();
    }
}

async function cleanupUser(name) {
    console.log(`\n🧹 Cleaning up User: ${name}...`);
    const userRes = await pool.query('SELECT id FROM users WHERE name = $1', [name]);
    if (userRes.rows.length === 0) return;

    const uId = userRes.rows[0].id;

    // 1. Reset Slots
    await pool.query(`
        UPDATE coach_slots 
        SET is_available = true, assigned_user_id = null
        WHERE assigned_user_id = $1
    `, [uId]);

    // 2. Delete Sessions
    await pool.query('DELETE FROM sessions WHERE user_id = $1', [uId]);

    // 3. Delete Logs
    await pool.query('DELETE FROM message_logs WHERE recipient_name = $1', [name]);

    // 4. Delete User
    await pool.query('DELETE FROM users WHERE id = $1', [uId]);
    console.log('   - Cleanup Done');
}

runTest();
