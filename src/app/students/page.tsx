'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Student {
    id: number;
    name: string;
    phone: string;
    status: string;
    product_type: string | null;
    coach_name: string | null;
    day_of_week: string | null;
    start_time: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    active: { label: '활성', color: 'bg-emerald-500/20 text-emerald-400' },
    pending: { label: '대기', color: 'bg-amber-500/20 text-amber-400' },
    completed: { label: '완료', color: 'bg-blue-500/20 text-blue-400' },
    paused: { label: '일시정지', color: 'bg-slate-500/20 text-slate-400' },
};

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    // Form states
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formStatus, setFormStatus] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Fetch students
    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/students');
            const data = await res.json();
            if (data.success) {
                setStudents(data.students);
            }
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, []);

    // Update student
    const handleUpdate = async (student: Student) => {
        try {
            const res = await fetch('/api/students', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: student.id,
                    name: formName || student.name,
                    phone: formPhone || student.phone,
                    status: formStatus || student.status,
                }),
            });
            const data = await res.json();

            if (data.success) {
                setSuccess(`${student.name} 수강생 정보 수정 완료!`);
                setEditingId(null);
                fetchStudents();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    // Delete student
    const handleDelete = async (student: Student) => {
        if (!confirm(`정말 ${student.name} 수강생을 삭제하시겠습니까?\n관련 세션 정보도 함께 삭제됩니다.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/students?id=${student.id}`, { method: 'DELETE' });
            const data = await res.json();

            if (data.success) {
                setSuccess(`${student.name} 수강생 삭제 완료`);
                fetchStudents();
                setTimeout(() => setSuccess(''), 3000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    // Start editing
    const startEdit = (student: Student) => {
        setEditingId(student.id);
        setFormName(student.name);
        setFormPhone(student.phone);
        setFormStatus(student.status);
        setError('');
    };

    // Filter students
    const filteredStudents = students.filter(student => {
        const matchesSearch = !searchTerm ||
            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.phone.includes(searchTerm) ||
            (student.coach_name && student.coach_name.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = filterStatus === 'all' || student.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                        수강생 관리
                    </h1>
                    <p className="text-slate-400 mt-1">수강생 조회/수정/삭제</p>
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

            {/* Search & Filter */}
            <div className="flex gap-4 mb-6">
                <input
                    type="text"
                    placeholder="이름, 전화번호, 코치명 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder:text-slate-500"
                />
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
                >
                    <option value="all">전체 상태</option>
                    <option value="active">활성</option>
                    <option value="pending">대기</option>
                    <option value="completed">완료</option>
                    <option value="paused">일시정지</option>
                </select>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-white">{students.length}</div>
                    <div className="text-xs text-slate-400">전체</div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{students.filter(s => s.status === 'active').length}</div>
                    <div className="text-xs text-slate-400">활성</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-amber-400">{students.filter(s => s.status === 'pending').length}</div>
                    <div className="text-xs text-slate-400">대기</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">{students.filter(s => s.status === 'completed').length}</div>
                    <div className="text-xs text-slate-400">완료</div>
                </div>
            </div>

            {/* Student List */}
            {loading ? (
                <div className="text-center text-slate-500 py-20">로딩 중...</div>
            ) : (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-slate-400">
                            <tr>
                                <th className="px-6 py-4">이름</th>
                                <th className="px-6 py-4">전화번호</th>
                                <th className="px-6 py-4">상태</th>
                                <th className="px-6 py-4">담당 코치</th>
                                <th className="px-6 py-4">수업 시간</th>
                                <th className="px-6 py-4">종료일</th>
                                <th className="px-6 py-4 text-right">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredStudents.map((student) => (
                                <tr key={student.id} className="hover:bg-slate-700/30 transition-colors">
                                    {editingId === student.id ? (
                                        <>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formName}
                                                    onChange={(e) => setFormName(e.target.value)}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-full text-sm"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <input
                                                    type="text"
                                                    value={formPhone}
                                                    onChange={(e) => setFormPhone(e.target.value)}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 w-full text-sm"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <select
                                                    value={formStatus}
                                                    onChange={(e) => setFormStatus(e.target.value)}
                                                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-sm"
                                                >
                                                    <option value="active">활성</option>
                                                    <option value="pending">대기</option>
                                                    <option value="completed">완료</option>
                                                    <option value="paused">일시정지</option>
                                                </select>
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">{student.coach_name || '-'}</td>
                                            <td className="px-6 py-4 text-slate-400">
                                                {student.day_of_week && student.start_time
                                                    ? `${student.day_of_week} ${student.start_time}`
                                                    : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-400">
                                                {student.end_date ? format(new Date(student.end_date), 'MM/dd') : '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleUpdate(student)} className="text-emerald-400 hover:underline mr-3 text-xs">저장</button>
                                                <button onClick={() => setEditingId(null)} className="text-slate-400 hover:underline text-xs">취소</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-4 font-medium text-white">{student.name}</td>
                                            <td className="px-6 py-4 text-slate-300 font-mono text-xs">{student.phone}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_LABELS[student.status]?.color || 'bg-slate-600 text-slate-300'}`}>
                                                    {STATUS_LABELS[student.status]?.label || student.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">{student.coach_name || <span className="text-slate-500">미배정</span>}</td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {student.day_of_week && student.start_time
                                                    ? `${student.day_of_week} ${student.start_time}`
                                                    : <span className="text-slate-500">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-slate-300">
                                                {student.end_date ? format(new Date(student.end_date), 'MM/dd') : <span className="text-slate-500">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => startEdit(student)} className="text-blue-400 hover:underline mr-3 text-xs">수정</button>
                                                <button onClick={() => handleDelete(student)} className="text-red-400 hover:underline text-xs">삭제</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        {searchTerm || filterStatus !== 'all'
                                            ? '검색 결과가 없습니다.'
                                            : '등록된 수강생이 없습니다. 래피드 결제 시 자동 등록됩니다.'}
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
