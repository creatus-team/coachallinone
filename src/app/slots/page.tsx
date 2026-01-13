'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Coach {
    id: number;
    name: string;
}

interface Slot {
    id: number;
    coach_id: number;
    coach_name: string;
    day_of_week: string;
    start_time: string;
    is_available: boolean;
    assigned_user_id: number | null;
}

const DAYS = ['월', '화', '수', '목', '금', '토', '일'];
const TIMES = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

export default function SlotManagePage() {
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [slots, setSlots] = useState<Slot[]>([]);
    const [selectedCoach, setSelectedCoach] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form states
    const [formDay, setFormDay] = useState('월');
    const [formTime, setFormTime] = useState('14:00');

    // Fetch data
    const fetchData = async () => {
        try {
            const [coachRes, slotRes] = await Promise.all([
                fetch('/api/coaches'),
                fetch('/api/slots'),
            ]);
            const coachData = await coachRes.json();
            const slotData = await slotRes.json();

            if (coachData.success) setCoaches(coachData.coaches);
            if (slotData.success) setSlots(slotData.slots);
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Add slot
    const handleAddSlot = async () => {
        if (!selectedCoach) {
            setError('코치를 먼저 선택해주세요');
            return;
        }

        try {
            const res = await fetch('/api/slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coachId: selectedCoach, dayOfWeek: formDay, startTime: formTime }),
            });
            const data = await res.json();

            if (data.success) {
                setSuccess('슬롯 추가 완료!');
                fetchData();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    // Delete slot
    const handleDeleteSlot = async (slot: Slot) => {
        if (!confirm(`${slot.coach_name} 코치의 ${slot.day_of_week} ${slot.start_time} 슬롯을 삭제하시겠습니까?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/slots?id=${slot.id}`, { method: 'DELETE' });
            const data = await res.json();

            if (data.success) {
                setSuccess('슬롯 삭제 완료');
                fetchData();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    // Toggle availability
    const handleToggleAvailable = async (slot: Slot) => {
        try {
            const res = await fetch('/api/slots', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: slot.id, isAvailable: !slot.is_available }),
            });
            const data = await res.json();

            if (data.success) {
                fetchData();
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    // Filter slots by selected coach
    const filteredSlots = selectedCoach
        ? slots.filter(s => s.coach_id === selectedCoach)
        : slots;

    const selectedCoachName = coaches.find(c => c.id === selectedCoach)?.name || '';

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                        슬롯 관리
                    </h1>
                    <p className="text-slate-400 mt-1">코치별 오픈 시간 설정</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/coaches/manage" className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors border border-purple-500/20">
                        🧢 코치 관리
                    </Link>
                    <Link href="/" className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors">
                        ← 대시보드
                    </Link>
                </div>
            </header>

            {/* Alerts */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6 text-red-400">
                    ❌ {error}
                    <button onClick={() => setError('')} className="float-right">✕</button>
                </div>
            )}
            {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-6 text-emerald-400">
                    ✅ {success}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Coach Selector */}
                <div className="lg:col-span-1">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <h2 className="text-lg font-semibold mb-4">코치 선택</h2>
                        <div className="space-y-2">
                            <button
                                onClick={() => setSelectedCoach(null)}
                                className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedCoach === null ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                    }`}
                            >
                                🔍 전체 보기
                            </button>
                            {coaches.map((coach) => (
                                <button
                                    key={coach.id}
                                    onClick={() => setSelectedCoach(coach.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${selectedCoach === coach.id ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                                        }`}
                                >
                                    {coach.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Add Slot Form */}
                    {selectedCoach && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mt-4">
                            <h2 className="text-lg font-semibold mb-4">슬롯 추가</h2>
                            <p className="text-sm text-slate-400 mb-3">대상: <span className="text-amber-400">{selectedCoachName}</span></p>
                            <div className="space-y-3">
                                <select
                                    value={formDay}
                                    onChange={(e) => setFormDay(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                >
                                    {DAYS.map(d => <option key={d} value={d}>{d}요일</option>)}
                                </select>
                                <select
                                    value={formTime}
                                    onChange={(e) => setFormTime(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white"
                                >
                                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <button
                                    onClick={handleAddSlot}
                                    className="w-full px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-colors"
                                >
                                    ➕ 슬롯 추가
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Slots Table */}
                <div className="lg:col-span-3">
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-slate-700">
                            <h2 className="text-lg font-semibold">
                                {selectedCoach ? `${selectedCoachName} 코치 슬롯` : '전체 슬롯'}
                                <span className="text-slate-400 text-sm ml-2">({filteredSlots.length}개)</span>
                            </h2>
                        </div>

                        {loading ? (
                            <div className="text-center text-slate-500 py-20">로딩 중...</div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-slate-900/50 text-slate-400 text-sm">
                                    <tr>
                                        <th className="px-6 py-4">코치</th>
                                        <th className="px-6 py-4">요일</th>
                                        <th className="px-6 py-4">시간</th>
                                        <th className="px-6 py-4">상태</th>
                                        <th className="px-6 py-4 text-right">작업</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {filteredSlots.map((slot) => (
                                        <tr key={slot.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-white">{slot.coach_name}</td>
                                            <td className="px-6 py-4">{slot.day_of_week}요일</td>
                                            <td className="px-6 py-4">{slot.start_time}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleToggleAvailable(slot)}
                                                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${slot.is_available
                                                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                                                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                                                        }`}
                                                >
                                                    {slot.is_available ? '✅ 오픈' : '🔒 마감'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteSlot(slot)}
                                                    className="text-red-400 hover:underline text-sm"
                                                >
                                                    삭제
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSlots.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                                {selectedCoach ? '이 코치의 슬롯이 없습니다. 왼쪽에서 추가해주세요.' : '등록된 슬롯이 없습니다.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
