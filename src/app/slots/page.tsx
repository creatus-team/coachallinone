'use client';

import { useState, useEffect } from 'react';

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

    const [formDay, setFormDay] = useState('월');
    const [formTime, setFormTime] = useState('14:00');

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

    const filteredSlots = selectedCoach
        ? slots.filter(s => s.coach_id === selectedCoach)
        : slots;

    const selectedCoachName = coaches.find(c => c.id === selectedCoach)?.name || '';

    return (
        <div className="p-8">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">슬롯</h1>
                <p className="text-gray-500 text-sm mt-1">코치별 오픈 시간 설정</p>
            </header>

            {/* Alerts */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-600 text-sm">
                    ❌ {error}
                    <button onClick={() => setError('')} className="float-right text-red-400 hover:text-red-600">✕</button>
                </div>
            )}
            {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6 text-emerald-600 text-sm">
                    ✅ {success}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Coach Selector */}
                <div className="lg:col-span-1">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                        <h2 className="text-sm font-semibold text-gray-800 mb-3">코치 선택</h2>
                        <div className="space-y-1.5">
                            <button
                                onClick={() => setSelectedCoach(null)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedCoach === null
                                    ? 'bg-emerald-50 text-emerald-600 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                🔍 전체 보기
                            </button>
                            {coaches.map((coach) => (
                                <button
                                    key={coach.id}
                                    onClick={() => setSelectedCoach(coach.id)}
                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedCoach === coach.id
                                        ? 'bg-emerald-50 text-emerald-600 font-medium'
                                        : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {coach.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Add Slot Form */}
                    {selectedCoach && (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 mt-4">
                            <h2 className="text-sm font-semibold text-gray-800 mb-3">슬롯 추가</h2>
                            <p className="text-xs text-gray-500 mb-3">대상: <span className="text-emerald-600 font-medium">{selectedCoachName}</span></p>
                            <div className="space-y-3">
                                <select
                                    value={formDay}
                                    onChange={(e) => setFormDay(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    {DAYS.map(d => <option key={d} value={d}>{d}요일</option>)}
                                </select>
                                <select
                                    value={formTime}
                                    onChange={(e) => setFormTime(e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <button
                                    onClick={handleAddSlot}
                                    className="w-full px-4 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium"
                                >
                                    + 슬롯 추가
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Slots Table */}
                <div className="lg:col-span-3">
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="font-semibold text-gray-800">
                                {selectedCoach ? `${selectedCoachName} 코치 슬롯` : '전체 슬롯'}
                            </h2>
                            <span className="text-gray-400 text-xs">{filteredSlots.length}개</span>
                        </div>

                        {loading ? (
                            <div className="text-center text-gray-400 py-20">로딩 중...</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                                        <th className="px-6 py-3">코치</th>
                                        <th className="px-6 py-3">요일</th>
                                        <th className="px-6 py-3">시간</th>
                                        <th className="px-6 py-3">상태</th>
                                        <th className="px-6 py-3 text-right">작업</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredSlots.map((slot) => (
                                        <tr key={slot.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-800">{slot.coach_name}</td>
                                            <td className="px-6 py-4 text-gray-600">{slot.day_of_week}요일</td>
                                            <td className="px-6 py-4 text-gray-600">{slot.start_time}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleToggleAvailable(slot)}
                                                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${slot.is_available
                                                        ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {slot.is_available ? '✅ 오픈' : '🔒 마감'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteSlot(slot)}
                                                    className="text-gray-400 hover:text-red-500 text-xs"
                                                >
                                                    삭제
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {filteredSlots.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
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
