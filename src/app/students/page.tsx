'use client';

import { useState, useEffect } from 'react';
import { format, isAfter, isBefore } from 'date-fns';

interface Student {
    id: number;
    name: string;
    phone: string;
    product_type: string | null;
    coach_name: string | null;
    day_of_week: string | null;
    start_time: string | null;
    start_date: string | null;
    end_date: string | null;
    created_at: string;
}

function getSessionStatus(student: Student): { label: string; color: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!student.start_date || !student.end_date) {
        return { label: '미배정', color: 'bg-gray-100 text-gray-500' };
    }

    const startDate = new Date(student.start_date);
    const endDate = new Date(student.end_date);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (isAfter(startDate, today)) {
        return { label: '대기', color: 'bg-amber-50 text-amber-600' };
    }
    if (isBefore(endDate, today)) {
        return { label: '종료', color: 'bg-gray-100 text-gray-500' };
    }
    return { label: '회차 진행 중', color: 'bg-emerald-50 text-emerald-600' };
}

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');

    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

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

    const handleUpdate = async (student: Student) => {
        try {
            const res = await fetch('/api/students', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: student.id,
                    name: formName || student.name,
                    phone: formPhone || student.phone,
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

    const startEdit = (student: Student) => {
        setEditingId(student.id);
        setFormName(student.name);
        setFormPhone(student.phone);
        setError('');
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch = !searchTerm ||
            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.phone.includes(searchTerm) ||
            (student.coach_name && student.coach_name.toLowerCase().includes(searchTerm.toLowerCase()));

        const status = getSessionStatus(student);
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && status.label === '회차 진행 중') ||
            (filterStatus === 'pending' && status.label === '대기') ||
            (filterStatus === 'completed' && status.label === '종료') ||
            (filterStatus === 'unassigned' && status.label === '미배정');

        return matchesSearch && matchesStatus;
    });

    const activeCount = students.filter(s => getSessionStatus(s).label === '회차 진행 중').length;
    const pendingCount = students.filter(s => getSessionStatus(s).label === '대기').length;
    const completedCount = students.filter(s => getSessionStatus(s).label === '종료').length;

    return (
        <div className="p-8">
            {/* Header */}
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">수강생</h1>
                    <p className="text-gray-500 text-sm mt-1">수강생 조회/수정/삭제</p>
                </div>
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

            {/* Search & Filter */}
            <div className="flex gap-4 mb-6">
                <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                    <input
                        type="text"
                        placeholder="이름, 전화번호, 코치명 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="all">전체 상태</option>
                    <option value="active">회차 진행 중</option>
                    <option value="pending">대기</option>
                    <option value="completed">종료</option>
                    <option value="unassigned">미배정</option>
                </select>
            </div>

            {/* Stats Mini Cards */}
            <div className="flex gap-4 mb-6">
                <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 text-center min-w-[100px]">
                    <div className="text-xl font-bold text-gray-800">{students.length}</div>
                    <div className="text-xs text-gray-500">전체</div>
                </div>
                <div className="bg-emerald-50 rounded-lg border border-emerald-200 px-4 py-3 text-center min-w-[100px]">
                    <div className="text-xl font-bold text-emerald-600">{activeCount}</div>
                    <div className="text-xs text-emerald-600">진행 중</div>
                </div>
                <div className="bg-amber-50 rounded-lg border border-amber-200 px-4 py-3 text-center min-w-[100px]">
                    <div className="text-xl font-bold text-amber-600">{pendingCount}</div>
                    <div className="text-xs text-amber-600">대기</div>
                </div>
                <div className="bg-gray-50 rounded-lg border border-gray-200 px-4 py-3 text-center min-w-[100px]">
                    <div className="text-xl font-bold text-gray-500">{completedCount}</div>
                    <div className="text-xs text-gray-500">종료</div>
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="text-center text-gray-400 py-20">로딩 중...</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                                <th className="px-6 py-3">이름</th>
                                <th className="px-6 py-3">연락처</th>
                                <th className="px-6 py-3">담당자</th>
                                <th className="px-6 py-3">수업 시간</th>
                                <th className="px-6 py-3">고객 상태</th>
                                <th className="px-6 py-3">종료일</th>
                                <th className="px-6 py-3 text-right">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredStudents.map((student) => {
                                const status = getSessionStatus(student);
                                return (
                                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                        {editingId === student.id ? (
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
                                                <td className="px-6 py-4 text-gray-500">{student.coach_name || '-'}</td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {student.day_of_week && student.start_time
                                                        ? `${student.day_of_week} ${student.start_time}`
                                                        : '-'}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {student.end_date ? format(new Date(student.end_date), 'yyyy.MM.dd') : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => handleUpdate(student)} className="text-emerald-600 hover:underline mr-3 text-xs">저장</button>
                                                    <button onClick={() => setEditingId(null)} className="text-gray-400 hover:underline text-xs">취소</button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="px-6 py-4 font-medium text-gray-800">{student.name}</td>
                                                <td className="px-6 py-4 text-gray-600 font-mono text-xs">{student.phone}</td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {student.coach_name ? (
                                                        <span className="flex items-center gap-1">
                                                            <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-xs">🧢</span>
                                                            {student.coach_name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600">
                                                    {student.day_of_week && student.start_time
                                                        ? `${student.day_of_week} ${student.start_time}`
                                                        : <span className="text-gray-400">-</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">
                                                    {student.end_date ? format(new Date(student.end_date), 'yyyy.MM.dd') : <span className="text-gray-400">-</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button onClick={() => startEdit(student)} className="text-gray-400 hover:text-emerald-600 mr-3 text-xs">수정</button>
                                                    <button onClick={() => handleDelete(student)} className="text-gray-400 hover:text-red-500 text-xs">삭제</button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        {searchTerm || filterStatus !== 'all'
                                            ? '검색 결과가 없습니다.'
                                            : '등록된 수강생이 없습니다.'}
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
