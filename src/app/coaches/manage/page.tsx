'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

    // Form states
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formLink, setFormLink] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Fetch coaches
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

    // Add coach
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

    // Update coach
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

    // Delete coach
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

    // Start editing
    const startEdit = (coach: Coach) => {
        setEditingId(coach.id);
        setFormName(coach.name);
        setFormPhone(coach.phone);
        setFormLink(coach.open_chat_link || '');
        setError('');
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        코치 관리
                    </h1>
                    <p className="text-slate-400 mt-1">코치 추가/수정/삭제</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); setError(''); }}
                        className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors border border-emerald-500/20"
                    >
                        ➕ 새 코치 추가
                    </button>
                    <Link href="/coaches" className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors">
                        👀 슬롯 현황
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
                </div>
            )}
            {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 mb-6 text-emerald-400">
                    ✅ {success}
                </div>
            )}

            {/* Add Form */}
            {showAddForm && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
                    <h2 className="text-lg font-semibold mb-4">새 코치 추가</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                            type="text"
                            placeholder="이름 *"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-500"
                        />
                        <input
                            type="text"
                            placeholder="전화번호 * (01012345678)"
                            value={formPhone}
                            onChange={(e) => setFormPhone(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-500"
                        />
                        <input
                            type="text"
                            placeholder="오픈채팅 링크 (선택)"
                            value={formLink}
                            onChange={(e) => setFormLink(e.target.value)}
                            className="bg-slate-900 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-500"
                        />
                    </div>
                    <div className="mt-4 flex gap-2">
                        <button onClick={handleAdd} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-colors">
                            추가하기
                        </button>
                        <button onClick={() => setShowAddForm(false)} className="px-6 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors">
                            취소
                        </button>
                    </div>
                </div>
            )}

            {/* Coach List */}
            {loading ? (
                <div className="text-center text-slate-500 py-20">로딩 중...</div>
            ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-slate-400 text-sm">
                            <tr>
                                <th className="px-6 py-4">이름</th>
                                <th className="px-6 py-4">전화번호</th>
                                <th className="px-6 py-4">오픈채팅</th>
                                <th className="px-6 py-4">슬롯</th>
                                <th className="px-6 py-4 text-right">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {coaches.map((coach) => (
                                <tr key={coach.id} className="hover:bg-slate-700/30 transition-colors">
                                    {editingId === coach.id ? (
                                        <>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formName}
                                                    onChange={(e) => setFormName(e.target.value)}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-full"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formPhone}
                                                    onChange={(e) => setFormPhone(e.target.value)}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-full"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formLink}
                                                    onChange={(e) => setFormLink(e.target.value)}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-full"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-emerald-400">{coach.available_slots}/{coach.total_slots}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleUpdate(coach)} className="text-emerald-400 hover:underline mr-3">저장</button>
                                                <button onClick={() => setEditingId(null)} className="text-slate-400 hover:underline">취소</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 font-medium text-white">{coach.name}</td>
                                            <td className="px-6 py-4 text-slate-300">{coach.phone}</td>
                                            <td className="px-6 py-4">
                                                {coach.open_chat_link ? (
                                                    <a href={coach.open_chat_link} target="_blank" className="text-blue-400 hover:underline text-sm">
                                                        🔗 링크
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-500">-</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-emerald-400 font-medium">{coach.available_slots}</span>
                                                <span className="text-slate-500">/{coach.total_slots}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => startEdit(coach)} className="text-blue-400 hover:underline mr-3">수정</button>
                                                <button onClick={() => handleDelete(coach)} className="text-red-400 hover:underline">삭제</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {coaches.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
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
