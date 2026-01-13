import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getCoachesWithSlots() {
    try {
        const coachesRes = await query(`
      SELECT 
        c.id, c.name, c.phone, c.open_chat_link,
        COUNT(cs.id) FILTER (WHERE cs.is_available = true) as available_slots,
        COUNT(cs.id) as total_slots
      FROM coaches c
      LEFT JOIN coach_slots cs ON c.id = cs.coach_id
      GROUP BY c.id
      ORDER BY c.name
    `);

        const slotsRes = await query(`
      SELECT 
        cs.*, 
        u.name as assigned_user_name
      FROM coach_slots cs
      LEFT JOIN users u ON cs.assigned_user_id = u.id
      ORDER BY cs.coach_id, cs.day_of_week, cs.start_time
    `);

        const slotsByCoach: Record<number, any[]> = {};
        for (const slot of slotsRes.rows) {
            if (!slotsByCoach[slot.coach_id]) {
                slotsByCoach[slot.coach_id] = [];
            }
            slotsByCoach[slot.coach_id].push(slot);
        }

        return {
            coaches: coachesRes.rows,
            slotsByCoach,
            error: null
        };
    } catch (e: any) {
        console.error('DB Error:', e);
        return { coaches: [], slotsByCoach: {} as Record<number, any[]>, error: e.message };
    }
}

export default async function CoachesPage() {
    const { coaches, slotsByCoach, error } = await getCoachesWithSlots();

    return (
        <div className="p-8">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">현황</h1>
                <p className="text-gray-500 text-sm mt-1">전문 코치 및 오픈 슬롯 현황</p>
            </header>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-600 text-sm">
                    오류: {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {coaches.map((coach: any) => (
                    <div key={coach.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        {/* Coach Header */}
                        <div className="p-5 border-b border-gray-100">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-800">{coach.name}</h2>
                                    <p className="text-gray-500 text-sm mt-0.5">{coach.phone}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xl font-bold text-emerald-600">
                                        {coach.available_slots}/{coach.total_slots}
                                    </div>
                                    <div className="text-xs text-gray-400">슬롯 여유</div>
                                </div>
                            </div>
                            {coach.open_chat_link && (
                                <a
                                    href={coach.open_chat_link}
                                    target="_blank"
                                    className="text-xs text-emerald-600 hover:underline mt-2 block truncate"
                                >
                                    🔗 오픈채팅 링크
                                </a>
                            )}
                        </div>

                        {/* Slots List */}
                        <div className="p-4 bg-gray-50">
                            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">오픈 슬롯</h3>
                            {(slotsByCoach[coach.id as number] || []).length > 0 ? (
                                <div className="space-y-2">
                                    {(slotsByCoach[coach.id as number] || []).map((slot: any) => (
                                        <div
                                            key={slot.id}
                                            className={`flex justify-between items-center p-3 rounded-lg ${slot.is_available
                                                ? 'bg-emerald-50 border border-emerald-200'
                                                : 'bg-white border border-gray-200'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-medium text-gray-800">
                                                    {slot.day_of_week} {slot.start_time}
                                                </div>
                                                {slot.assigned_user_name && (
                                                    <div className="text-xs text-gray-500">
                                                        → {slot.assigned_user_name}
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${slot.is_available
                                                ? 'bg-emerald-100 text-emerald-600'
                                                : 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {slot.is_available ? '배정 가능' : '배정됨'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-gray-400 py-6 text-sm">
                                    등록된 슬롯 없음
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {coaches.length === 0 && !error && (
                <div className="text-center text-gray-400 py-20">
                    등록된 코치가 없습니다.
                </div>
            )}
        </div>
    );
}
