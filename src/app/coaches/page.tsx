'use client';

import { useState, useEffect } from 'react';

interface Slot {
    id: number;
    day_of_week: string;
    start_time: string;
    is_available: boolean;
    assigned_user_name: string | null;
    session_end_date: string | null;
}

interface Coach {
    id: number;
    name: string;
    phone: string;
    open_chat_link: string | null;
    available_slots: number;
    total_slots: number;
    status: string;
    tier: string;
    start_date: string | null;
    active_students: number;
    retention_this_month: number;
    retention_last_month: number;
    slots?: Slot[];
}

export default function CoachesPage() {
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedCoach, setExpandedCoach] = useState<number | null>(null);
    const [slots, setSlots] = useState<Record<number, Slot[]>>({});

    // Form states
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formLink, setFormLink] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchCoaches = async () => {
        try {
            const res = await fetch('/api/coaches');
            const data = await res.json();
            if (data.success) {
                setCoaches(data.coaches);
            }
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchSlots = async (coachId: number) => {
        try {
            const res = await fetch(`/api/slots?coachId=${coachId}`);
            const data = await res.json();
            if (data.success) {
                setSlots(prev => ({ ...prev, [coachId]: data.slots }));
            }
        } catch (e) {
            console.error('Slots fetch error:', e);
        }
    };

    useEffect(() => {
        fetchCoaches();
    }, []);

    const toggleExpand = (coachId: number) => {
        if (expandedCoach === coachId) {
            setExpandedCoach(null);
        } else {
            setExpandedCoach(coachId);
            if (!slots[coachId]) {
                fetchSlots(coachId);
            }
        }
    };

    const handleAdd = async () => {
        setError('');
        if (!formName || !formPhone) {
            setError('이름과 전화번호는 필수입니다');
            return;
        }

        try {
            const res = await fetch('/api/coaches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: formName, phone: formPhone, openChatLink: formLink }),
            });
            const data = await res.json();

            if (data.success) {
                setSuccess(`${formName} 코치 추가 완료!`);
                setFormName(''); setFormPhone(''); setFormLink('');
                setShowAddForm(false);
                fetchCoaches();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleUpdate = async (coach: Coach) => {
        try {
            const res = await fetch('/api/coaches', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: coach.id,
                    name: formName || coach.name,
                    phone: formPhone || coach.phone,
                    openChatLink: formLink || coach.open_chat_link,
                }),
            });
            const data = await res.json();

            if (data.success) {
                setSuccess(`${coach.name} 코치 정보 수정 완료!`);
                setEditingId(null);
                fetchCoaches();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleDelete = async (coach: Coach) => {
        if (!confirm(`정말 ${coach.name} 코치를 삭제하시겠습니까?\n연결된 슬롯도 함께 삭제됩니다.`)) return;

        try {
            const res = await fetch(`/api/coaches?id=${coach.id}`, { method: 'DELETE' });
            const data = await res.json();

            if (data.success) {
                setSuccess(`${coach.name} 코치 삭제 완료`);
                fetchCoaches();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    const startEdit = (coach: Coach) => {
        setEditingId(coach.id);
        setFormName(coach.name);
        setFormPhone(coach.phone);
        setFormLink(coach.open_chat_link || '');
        setError('');
    };

    return (
        <div className="p-8">
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">코치</h1>
                    <p className="text-gray-500 text-sm mt-1">코치 관리 및 슬롯 현황</p>
                </div>
                <button
                    onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); setError(''); }}
                    className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                >
                    + 코치 추가
                </button>
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

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">새 코치 추가</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder="이름 *"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                            type="text"
                            placeholder="전화번호 * (01012345678)"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                            className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <input
                            type="text"
                            placeholder="오픈채팅 링크 (선택)"
                            value={formLink}
                            onChange={(e) => setFormLink(e.target.value)}
                            className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button onClick={handleAdd} className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors text-sm font-medium">
                            추가하기
                        </button>
                        <button onClick={() => setShowAddForm(false)} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                            취소
                        </button>
                    </div>
                </div>
            )}

            {/* Coach List with Expandable Slots */}
            {loading ? (
                <div className="text-center text-gray-400 py-20">로딩 중...</div>
            ) : (
                <div className="space-y-4">
                    {coaches.map((coach) => (
                        <div key={coach.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                            {/* Coach Row */}
                            <div
                                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleExpand(coach.id)}
                            >
                                {editingId === coach.id ? (
                                    <div className="flex gap-2 flex-1" onClick={(e) => e.stopPropagation()}>
                                        <input
                                            type="text"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            className="border border-gray-200 rounded px-3 py-2 text-sm w-32"
                                        />
                                        <input
                                            type="text"
                                            value={formPhone}
                                            onChange={(e) => setFormPhone(e.target.value)}
                                            className="border border-gray-200 rounded px-3 py-2 text-sm w-36"
                                        />
                                        <input
                                            type="text"
                                            value={formLink}
                                            onChange={(e) => setFormLink(e.target.value)}
                                            placeholder="오픈채팅 링크"
                                            className="border border-gray-200 rounded px-3 py-2 text-sm flex-1"
                                        />
                                        <button onClick={() => handleUpdate(coach)} className="text-emerald-600 hover:underline text-sm">저장</button>
                                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:underline text-sm">취소</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xl">{expandedCoach === coach.id ? '🔽' : '▶️'}</span>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-gray-800">{coach.name}</h3>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${coach.status === '활동' ? 'bg-emerald-100 text-emerald-600' :
                                                        coach.status === '휴직' ? 'bg-amber-100 text-amber-600' :
                                                            'bg-gray-100 text-gray-500'
                                                        }`}>{coach.status || '활동'}</span>
                                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                                                        {coach.tier || '정식코치'}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500">{coach.phone}</p>
                                            </div>
                                            {coach.open_chat_link && (
                                                <a
                                                    href={coach.open_chat_link}
                                                    target="_blank"
                                                    className="text-xs text-emerald-600 hover:underline"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    🔗 오픈채팅
                                                </a>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="text-center">
                                                <div className="text-xl font-bold text-violet-600">{coach.active_students || 0}</div>
                                                <div className="text-xs text-gray-400">담당 수강생</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xl font-bold text-emerald-600">
                                                    {coach.available_slots}<span className="text-gray-400 text-lg">/{coach.total_slots}</span>
                                                </div>
                                                <div className="text-xs text-gray-400">오픈 슬롯</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-xl font-bold text-blue-600">{coach.retention_this_month}%</div>
                                                <div className="text-xs text-gray-400">리텐션</div>
                                            </div>
                                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button onClick={() => startEdit(coach)} className="text-gray-400 hover:text-emerald-600 text-xs">수정</button>
                                                <button onClick={() => handleDelete(coach)} className="text-gray-400 hover:text-red-500 text-xs">삭제</button>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Expanded Slots */}
                            {expandedCoach === coach.id && (
                                <div className="border-t border-gray-100 bg-gray-50 p-5">
                                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">슬롯 현황</h4>
                                    {slots[coach.id] ? (
                                        slots[coach.id].length > 0 ? (
                                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                                {slots[coach.id].map((slot) => (
                                                    <div
                                                        key={slot.id}
                                                        className={`p-3 rounded-lg border ${slot.is_available
                                                            ? 'bg-emerald-50 border-emerald-200'
                                                            : 'bg-white border-gray-200'
                                                            }`}
                                                    >
                                                        <div className="font-medium text-gray-800">
                                                            {slot.day_of_week} {slot.start_time}
                                                        </div>
                                                        {slot.is_available ? (
                                                            <span className="text-xs text-emerald-600">✅ 배정 가능</span>
                                                        ) : (
                                                            <div>
                                                                <span className="text-xs text-red-600">🔴 {slot.assigned_user_name || '배정됨'}</span>
                                                                {slot.session_end_date && (
                                                                    <span className="text-xs text-gray-400 ml-1">
                                                                        ~{new Date(slot.session_end_date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center text-gray-400 py-6 text-sm">등록된 슬롯이 없습니다</div>
                                        )
                                    ) : (
                                        <div className="text-center text-gray-400 py-4 text-sm">로딩 중...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {coaches.length === 0 && (
                        <div className="text-center text-gray-400 py-20">
                            등록된 코치가 없습니다. 위에서 새 코치를 추가해주세요.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
