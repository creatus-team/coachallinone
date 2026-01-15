'use client';

import { useState, useEffect } from 'react';
import { format, isAfter, isBefore } from 'date-fns';
import Link from 'next/link';

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
    session_id?: number;
    extension_count?: number;
    first_start_date?: string;
    total_sessions?: number;
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
    return { label: '진행중', color: 'bg-emerald-50 text-emerald-600' };
}

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 휴강 모달 상태
    const [breakModalOpen, setBreakModalOpen] = useState(false);
    const [breakStudent, setBreakStudent] = useState<Student | null>(null);
    const [breakWeeks, setBreakWeeks] = useState(1);
    const [breakReason, setBreakReason] = useState('');

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

    const handleBreak = async () => {
        if (!breakStudent?.session_id) {
            setError('세션 정보가 없어 휴강 처리할 수 없습니다');
            setBreakModalOpen(false);
            return;
        }

        try {
            const res = await fetch('/api/breaks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: breakStudent.session_id,
                    breakWeeks,
                    reason: breakReason
                }),
            });
            const data = await res.json();

            if (data.success) {
                setSuccess(`${breakStudent.name} ${breakWeeks}주 휴강 처리 완료!`);
                setBreakModalOpen(false);
                setBreakStudent(null);
                fetchStudents();
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleCancel = async (student: Student) => {
        const reason = prompt(`${student.name} 수강생의 매칭을 취소합니다.\n취소 사유를 입력하세요:`);
        if (reason === null) return;

        try {
            const res = await fetch('/api/cancellations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: student.id, reason }),
            });
            const data = await res.json();

            if (data.success) {
                setSuccess(`${student.name} 매칭 취소 완료!`);
                fetchStudents();
                setTimeout(() => setSuccess(''), 5000);
            } else {
                setError(data.error);
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    const openBreakModal = (student: Student) => {
        setBreakStudent(student);
        setBreakWeeks(1);
        setBreakReason('');
        setBreakModalOpen(true);
    };

    const filteredStudents = students.filter(student => {
        const matchesSearch = !searchTerm ||
            student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            student.phone.includes(searchTerm) ||
            (student.coach_name && student.coach_name.toLowerCase().includes(searchTerm.toLowerCase()));

        const status = getSessionStatus(student);
        const matchesStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && status.label === '진행중') ||
            (filterStatus === 'pending' && status.label === '대기') ||
            (filterStatus === 'completed' && status.label === '종료') ||
            (filterStatus === 'unassigned' && status.label === '미배정');

        return matchesSearch && matchesStatus;
    });

    const activeCount = students.filter(s => getSessionStatus(s).label === '진행중').length;
    const pendingCount = students.filter(s => getSessionStatus(s).label === '대기').length;
    const completedCount = students.filter(s => getSessionStatus(s).label === '종료').length;

    return (
        <div className="p-8">
            {/* 휴강 모달 */}
            {breakModalOpen && breakStudent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">휴강 신청</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            <strong>{breakStudent.name}</strong> 수강생의 휴강을 신청합니다.
                        </p>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">휴강 기간</label>
                                <select
                                    value={breakWeeks}
                                    onChange={(e) => setBreakWeeks(parseInt(e.target.value))}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                >
                                    <option value={1}>1주</option>
                                    <option value={2}>2주</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">사유</label>
                                <input
                                    type="text"
                                    value={breakReason}
                                    onChange={(e) => setBreakReason(e.target.value)}
                                    placeholder="예: 가족 행사, 개인 사정"
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={handleBreak} className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600">휴강 신청</button>
                            <button onClick={() => setBreakModalOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200">취소</button>
                        </div>
                    </div>
                </div>
            )}

            {/* System Status Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-emerald-700 font-medium">시스템 정상 작동 중</span>
            </div>

            {/* Header */}
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">수강생</h1>
                <p className="text-gray-500 text-sm mt-1">수강생 조회 및 관리</p>
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
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
                <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600"
                >
                    <option value="all">전체 상태</option>
                    <option value="active">진행중</option>
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
                    <div className="text-xs text-emerald-600">진행중</div>
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
                                <th className="px-4 py-3">이름</th>
                                <th className="px-4 py-3">연락처</th>
                                <th className="px-4 py-3">담당코치</th>
                                <th className="px-4 py-3">수업시간</th>
                                <th className="px-4 py-3">회차시작</th>
                                <th className="px-4 py-3">상태</th>
                                <th className="px-4 py-3">재결제</th>
                                <th className="px-4 py-3">첫결제</th>
                                <th className="px-4 py-3 text-right">액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredStudents.map((student) => {
                                const status = getSessionStatus(student);
                                const isActive = status.label === '진행중';
                                const isRepayment = (student.extension_count || 0) > 0;

                                return (
                                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            <Link href={`/students/${student.id}`} className="hover:text-emerald-600 hover:underline">
                                                {student.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">{student.phone}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {student.coach_name ? (
                                                <span className="flex items-center gap-1">
                                                    <span className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center text-xs">🧢</span>
                                                    {student.coach_name}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {student.day_of_week && student.start_time
                                                ? `${student.day_of_week} ${student.start_time}`
                                                : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {student.start_date ? format(new Date(student.start_date), 'MM.dd') : '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                                                {status.label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {isRepayment ? (
                                                <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
                                                    🔄 {student.extension_count}회
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-xs">신규</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {student.first_start_date ? format(new Date(student.first_start_date), 'yy.MM.dd') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            {isActive && (
                                                <>
                                                    <button onClick={() => openBreakModal(student)} className="text-amber-500 hover:underline mr-2 text-xs">휴강</button>
                                                    <button onClick={() => handleCancel(student)} className="text-red-400 hover:underline text-xs">취소</button>
                                                </>
                                            )}
                                            {!isActive && <span className="text-gray-300 text-xs">-</span>}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredStudents.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                                        {searchTerm || filterStatus !== 'all' ? '검색 결과가 없습니다.' : '등록된 수강생이 없습니다.'}
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
