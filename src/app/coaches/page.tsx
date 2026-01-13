import { query } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getCoachesWithSlots() {
    try {
        // Get all coaches with their slot counts
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

        // Get detailed slots for each coach
        const slotsRes = await query(`
      SELECT 
        cs.*, 
        u.name as assigned_user_name
      FROM coach_slots cs
      LEFT JOIN users u ON cs.assigned_user_id = u.id
      ORDER BY cs.coach_id, cs.day_of_week, cs.start_time
    `);

        // Group slots by coach
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
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        코치 관리
                    </h1>
                    <p className="text-slate-400 mt-1">전문 코치 및 오픈 슬롯 현황</p>
                </div>
                <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                    ← 대시보드로
                </Link>
            </header>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400">
                    오류: {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {coaches.map((coach: any) => (
                    <div key={coach.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden backdrop-blur-sm">
                        {/* Coach Header */}
                        <div className="p-5 border-b border-slate-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold text-white">{coach.name}</h2>
                                    <p className="text-slate-400 text-sm mt-1">{coach.phone}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-emerald-400">
                                        {coach.available_slots}/{coach.total_slots}
                                    </div>
                                    <div className="text-xs text-slate-500">슬롯 여유</div>
                                </div>
                            </div>
                            {coach.open_chat_link && (
                                <a
                                    href={coach.open_chat_link}
                                    target="_blank"
                                    className="text-xs text-blue-400 hover:underline mt-2 block truncate"
                                >
                                    🔗 오픈채팅 링크
                                </a>
                            )}
                        </div>

                        {/* Slots List */}
                        <div className="p-4">
                            <h3 className="text-sm font-medium text-slate-400 mb-3">오픈 슬롯</h3>
                            {(slotsByCoach[coach.id as number] || []).length > 0 ? (
                                <div className="space-y-2">
                                    {(slotsByCoach[coach.id as number] || []).map((slot: any) => (
                                        <div
                                            key={slot.id}
                                            className={`flex justify-between items-center p-3 rounded-lg ${slot.is_available
                                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                : 'bg-slate-700/50 border border-slate-600'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="text-lg">{getDayEmoji(slot.day_of_week)}</span>
                                                <div>
                                                    <div className="font-medium text-white">
                                                        {slot.day_of_week} {slot.start_time}
                                                    </div>
                                                    {slot.assigned_user_name && (
                                                        <div className="text-xs text-slate-400">
                                                            → {slot.assigned_user_name}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${slot.is_available
                                                ? 'bg-emerald-500/20 text-emerald-400'
                                                : 'bg-slate-600 text-slate-300'
                                                }`}>
                                                {slot.is_available ? '배정 가능' : '배정됨'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-slate-500 py-6">
                                    등록된 슬롯 없음
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {coaches.length === 0 && !error && (
                <div className="text-center text-slate-500 py-20">
                    등록된 코치가 없습니다.
                </div>
            )}
        </div>
    );
}

function getDayEmoji(day: string): string {
    const emojis: Record<string, string> = {
        '월': '🌙',
        '화': '🔥',
        '수': '💧',
        '목': '🌳',
        '금': '💰',
        '토': '🌍',
        '일': '☀️',
    };
    return emojis[day] || '📅';
}
