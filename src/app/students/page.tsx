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
    session_id?: number;
    extension_count?: number;
    first_start_date?: string;
    total_sessions?: number;
}

interface ActivityLog {
    id: number;
    action_type: string;
    old_value?: string;
    new_value?: string;
    reason?: string;
    created_at: string;
}

function getSessionStatus(student: Student): { label: string; color: string } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!student.start_date || !student.end_date) return { label: '미배정', color: 'bg-gray-100 text-gray-500' };
    const startDate = new Date(student.start_date);
    const endDate = new Date(student.end_date);
    if (isAfter(startDate, today)) return { label: '대기', color: 'bg-amber-50 text-amber-600' };
    if (isBefore(endDate, today)) return { label: '종료', color: 'bg-gray-100 text-gray-500' };
    return { label: '진행중', color: 'bg-emerald-50 text-emerald-600' };
}

export default function StudentsPage() {
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [memo, setMemo] = useState('');
    const [memoSaving, setMemoSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // 휴강 모달
    const [breakModalOpen, setBreakModalOpen] = useState(false);
    const [breakStudent, setBreakStudent] = useState<Student | null>(null);
    const [breakWeeks, setBreakWeeks] = useState(1);
    const [breakReason, setBreakReason] = useState('');

    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/students');
            const data = await res.json();
            if (data.success) setStudents(data.students);
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStudents(); }, []);

    const toggleExpand = async (student: Student) => {
        if (expandedId === student.id) {
            setExpandedId(null);
            return;
        }
        setExpandedId(student.id);
        // Fetch logs and memo
        try {
            const [logsRes, memoRes] = await Promise.all([
                fetch(`/api/students/${student.id}/logs`),
                fetch(`/api/students/${student.id}/memos`)
            ]);
            const logsData = await logsRes.json();
            const memoData = await memoRes.json();
            setLogs(logsData.logs || []);
            setMemo(memoData.memos?.[0]?.content || '');
        } catch (e) {
            console.error('Error loading details:', e);
        }
    };

    const saveMemo = async (studentId: number) => {
        setMemoSaving(true);
        try {
            await fetch(`/api/students/${studentId}/memos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: memo })
            });
            setSuccess('메모 저장됨');
            setTimeout(() => setSuccess(''), 2000);
        } catch (e) {
            console.error('Memo save error:', e);
        } finally {
            setMemoSaving(false);
        }
    };

    const handleBreak = async () => {
        if (!breakStudent?.session_id) { setError('세션 정보 없음'); setBreakModalOpen(false); return; }
        try {
            const res = await fetch('/api/breaks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: breakStudent.session_id, breakWeeks, reason: breakReason }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(`${breakStudent.name} ${breakWeeks}주 휴강 처리!`);
                setBreakModalOpen(false);
                fetchStudents();
                setTimeout(() => setSuccess(''), 3000);
            } else setError(data.error);
        } catch (e: any) { setError(e.message); }
    };

    const handleCancel = async (student: Student) => {
        const reason = prompt(`${student.name} 매칭 취소 사유:`);
        if (reason === null) return;
        try {
            const res = await fetch('/api/cancellations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: student.id, reason }),
            });
            const data = await res.json();
            if (data.success) { setSuccess(`${student.name} 취소 완료!`); fetchStudents(); setTimeout(() => setSuccess(''), 3000); }
            else setError(data.error);
        } catch (e: any) { setError(e.message); }
    };

    const filteredStudents = students.filter(s => {
        const matchSearch = !searchTerm || s.name.includes(searchTerm) || s.phone.includes(searchTerm) || s.coach_name?.includes(searchTerm);
        const status = getSessionStatus(s);
        const matchStatus = filterStatus === 'all' ||
            (filterStatus === 'active' && status.label === '진행중') ||
            (filterStatus === 'pending' && status.label === '대기') ||
            (filterStatus === 'completed' && status.label === '종료');
        return matchSearch && matchStatus;
    });

    const activeCount = students.filter(s => getSessionStatus(s).label === '진행중').length;
    const pendingCount = students.filter(s => getSessionStatus(s).label === '대기').length;

    return (
        <div className="p-8">
            {/* 휴강 모달 */}
            {breakModalOpen && breakStudent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md">
                        <h3 className="text-lg font-bold mb-4">휴강 신청 - {breakStudent.name}</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">휴강 기간</label>
                                <select value={breakWeeks} onChange={(e) => setBreakWeeks(parseInt(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm">
                                    <option value={1}>1주</option>
                                    <option value={2}>2주</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-600 mb-1">사유</label>
                                <input type="text" value={breakReason} onChange={(e) => setBreakReason(e.target.value)} placeholder="사유" className="w-full border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={handleBreak} className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium">신청</button>
                            <button onClick={() => setBreakModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm">취소</button>
                        </div>
                    </div>
                </div>
            )}

            {/* System Status */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-emerald-700 font-medium">시스템 정상</span>
            </div>

            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">수강생</h1>
            </header>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-600 text-sm">❌ {error}</div>}
            {success && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 text-emerald-600 text-sm">✅ {success}</div>}

            {/* Search & Stats */}
            <div className="flex gap-4 mb-6">
                <input type="text" placeholder="검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 pl-4 pr-4 py-2 border rounded-lg text-sm" />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border rounded-lg text-sm">
                    <option value="all">전체</option>
                    <option value="active">진행중</option>
                    <option value="pending">대기</option>
                    <option value="completed">종료</option>
                </select>
            </div>

            <div className="flex gap-4 mb-6">
                <div className="bg-white border rounded-lg px-4 py-2 text-center"><div className="text-lg font-bold">{students.length}</div><div className="text-xs text-gray-500">전체</div></div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-center"><div className="text-lg font-bold text-emerald-600">{activeCount}</div><div className="text-xs text-emerald-600">진행중</div></div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center"><div className="text-lg font-bold text-amber-600">{pendingCount}</div><div className="text-xs text-amber-600">대기</div></div>
            </div>

            {/* Student List */}
            {loading ? <div className="text-center py-20 text-gray-400">로딩 중...</div> : (
                <div className="space-y-2">
                    {filteredStudents.map((student) => {
                        const status = getSessionStatus(student);
                        const isExpanded = expandedId === student.id;
                        const isRepayment = (student.extension_count || 0) > 0;
                        const isActive = status.label === '진행중';

                        return (
                            <div key={student.id} className="bg-white border rounded-xl overflow-hidden">
                                {/* Header Row */}
                                <div className={`px-4 py-3 flex items-center gap-4 cursor-pointer hover:bg-gray-50 ${isExpanded ? 'bg-gray-50 border-b' : ''}`} onClick={() => toggleExpand(student)}>
                                    <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
                                    <span className="font-medium text-gray-800 w-20">{student.name}</span>
                                    <span className="text-gray-500 font-mono text-xs w-28">{student.phone}</span>
                                    <span className="text-gray-600 text-sm w-20">{student.coach_name || '-'}</span>
                                    <span className="text-gray-600 text-sm w-28">{student.day_of_week} {student.start_time || ''}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                                    {isRepayment && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">🔄 {student.extension_count}회</span>}
                                    <span className="text-gray-400 text-xs ml-auto">{student.first_start_date ? format(new Date(student.first_start_date), 'yy.MM.dd') : '-'}</span>
                                    {isActive && (
                                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                            <button onClick={() => { setBreakStudent(student); setBreakModalOpen(true); }} className="text-amber-500 text-xs hover:underline">휴강</button>
                                            <button onClick={() => handleCancel(student)} className="text-red-400 text-xs hover:underline">취소</button>
                                        </div>
                                    )}
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="p-4 bg-gray-50">
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="bg-white p-3 rounded-lg border">
                                                <h4 className="text-xs text-gray-500 mb-2">📋 기본 정보</h4>
                                                <div className="text-sm space-y-1">
                                                    <div>첫결제: {student.first_start_date ? format(new Date(student.first_start_date), 'yyyy.MM.dd') : '-'}</div>
                                                    <div>현회차: {student.start_date ? format(new Date(student.start_date), 'M/d') : '-'} ~ {student.end_date ? format(new Date(student.end_date), 'M/d') : '-'}</div>
                                                </div>
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border">
                                                <h4 className="text-xs text-gray-500 mb-2">📊 활동 로그</h4>
                                                {logs.length > 0 ? (
                                                    <div className="text-xs space-y-1 max-h-20 overflow-y-auto">
                                                        {logs.slice(0, 3).map(log => (
                                                            <div key={log.id} className="flex gap-2">
                                                                <span className="text-gray-400">{format(new Date(log.created_at), 'MM.dd')}</span>
                                                                <span className="px-1 bg-gray-100 rounded">{log.action_type}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <div className="text-xs text-gray-400">기록 없음</div>}
                                            </div>
                                            <div className="bg-white p-3 rounded-lg border">
                                                <h4 className="text-xs text-gray-500 mb-2">📌 메모</h4>
                                                <textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모..." className="w-full text-xs border rounded p-2 h-16 resize-none" />
                                                <button onClick={() => saveMemo(student.id)} disabled={memoSaving} className="mt-1 text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">
                                                    {memoSaving ? '저장중...' : '저장'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filteredStudents.length === 0 && <div className="text-center py-12 text-gray-400">수강생이 없습니다.</div>}
                </div>
            )}
        </div>
    );
}
