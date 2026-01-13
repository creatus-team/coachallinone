'use client';

import { useState, useEffect } from 'react';

interface Coach {
    id: number;
    name: string;
    phone: string;
    open_chat_link: string | null;
    available_slots: number;
    total_slots: number;
}

export default function CoachManagePage() {
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        fetchCoaches();
    }, []);

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
                setFormName('');
                setFormPhone('');
                setFormLink('');
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
        if (!confirm(`정말 ${coach.name} 코치를 삭제하시겠습니까?\n연결된 슬롯도 함께 삭제됩니다.`)) {
            return;
        }

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
                    <p className="text-gray-500 text-sm mt-1">코치 추가/수정/삭제</p>
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

            {/* Coach List */}
            {loading ? (
                <div className="text-center text-gray-400 py-20">로딩 중...</div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                                <th className="px-6 py-3">이름</th>
                                <th className="px-6 py-3">전화번호</th>
                                <th className="px-6 py-3">오픈채팅</th>
                                <th className="px-6 py-3">슬롯</th>
                                <th className="px-6 py-3 text-right">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {coaches.map((coach) => (
                                <tr key={coach.id} className="hover:bg-gray-50 transition-colors">
                                    {editingId === coach.id ? (
                                        <>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formName}
                                                    onChange={(e) => setFormName(e.target.value)}
                                                    className="border border-gray-200 rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formPhone}
                                                    onChange={(e) => setFormPhone(e.target.value)}
                                                    className="border border-gray-200 rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formLink}
                                                    onChange={(e) => setFormLink(e.target.value)}
                                                    className="border border-gray-200 rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-emerald-600">{coach.available_slots}/{coach.total_slots}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleUpdate(coach)} className="text-emerald-600 hover:underline mr-3 text-xs">저장</button>
                                                <button onClick={() => setEditingId(null)} className="text-gray-400 hover:underline text-xs">취소</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 font-medium text-gray-800">{coach.name}</td>
                                            <td className="px-6 py-4 text-gray-600">{coach.phone}</td>
                                            <td className="px-6 py-4">
                                                {coach.open_chat_link ? (
                                                    <a href={coach.open_chat_link} target="_blank" className="text-emerald-600 hover:underline text-xs">
                                                        🔗 링크
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-emerald-600 font-medium">{coach.available_slots}</span>
                                                <span className="text-gray-400">/{coach.total_slots}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => startEdit(coach)} className="text-gray-400 hover:text-emerald-600 mr-3 text-xs">수정</button>
                                                <button onClick={() => handleDelete(coach)} className="text-gray-400 hover:text-red-500 text-xs">삭제</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {coaches.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                        등록된 코치가 없습니다. 위에서 새 코치를 추가해주세요.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
