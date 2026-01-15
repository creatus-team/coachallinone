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

function getDaysLeft(endDate: string | null): string {
    if (!endDate) return '-';
    const today = new Date();
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return '종료';
    if (diff === 0) return 'D-Day';
    return `D-${diff}`;
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
    const [memoSaved, setMemoSaved] = useState(false);
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
            setLogs([]);
            setMemo('');
            return;
        }
        setExpandedId(student.id);
        setMemoSaved(false);

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
            const res = await fetch(`/api/students/${studentId}/memos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: memo })
            });
            const data = await res.json();
            if (data.success) {
                setMemoSaved(true);
                setTimeout(() => setMemoSaved(false), 3000);
            }
        } catch (e) {
            console.error('Memo save error:', e);
            setError('메모 저장 실패');
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
        <div className="p-6">
            {/* 휴강 모달 */}
            {breakModalOpen && breakStudent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-bold mb-4">⏸️ 휴강 신청 - {breakStudent.name}</h3>
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
                                <input type="text" value={breakReason} onChange={(e) => setBreakReason(e.target.value)} placeholder="예: 개인사정, 여행" className="w-full border rounded-lg px-3 py-2 text-sm" />
                            </div>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button onClick={handleBreak} className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">휴강 신청</button>
                            <button onClick={() => setBreakModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 rounded-lg font-medium hover:bg-gray-200">취소</button>
                        </div>
                    </div>
                </div>
            )}

            {/* System Status */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 mb-5 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                <span className="text-sm text-emerald-700 font-medium">시스템 정상</span>
            </div>

            <header className="mb-5">
                <h1 className="text-xl font-bold text-gray-800">수강생</h1>
            </header>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-600 text-sm">❌ {error} <button onClick={() => setError('')} className="float-right">✕</button></div>}
            {success && <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 mb-4 text-emerald-600 text-sm">✅ {success}</div>}

            {/* Search & Stats */}
            <div className="flex gap-3 mb-5">
                <input type="text" placeholder="🔍 이름, 전화번호, 코치명 검색..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 px-4 py-2 border rounded-lg text-sm" />
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border rounded-lg text-sm bg-white">
                    <option value="all">전체</option>
                    <option value="active">진행중</option>
                    <option value="pending">대기</option>
                    <option value="completed">종료</option>
                </select>
            </div>

            <div className="flex gap-3 mb-5">
                <div className="bg-white border rounded-lg px-4 py-2 text-center"><div className="text-lg font-bold">{students.length}</div><div className="text-xs text-gray-500">전체</div></div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-center"><div className="text-lg font-bold text-emerald-600">{activeCount}</div><div className="text-xs text-emerald-600">진행중</div></div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-center"><div className="text-lg font-bold text-amber-600">{pendingCount}</div><div className="text-xs text-amber-600">대기</div></div>
            </div>

            {/* Student List */}
            {loading ? <div className="text-center py-20 text-gray-400">로딩 중...</div> : (
                <div className="space-y-3">
                    {filteredStudents.map((student) => {
                        const status = getSessionStatus(student);
                        const isExpanded = expandedId === student.id;
                        const isRepayment = (student.extension_count || 0) > 0;
                        const isActive = status.label === '진행중';
                        const daysLeft = getDaysLeft(student.end_date);

                        return (
                            <div key={student.id} className={`bg-white border rounded-xl overflow-hidden shadow-sm ${isExpanded ? 'ring-2 ring-emerald-200' : ''}`}>
                                {/* Header Row */}
                                <div
                                    className={`px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors`}
                                    onClick={() => toggleExpand(student)}
                                >
                                    <span className="text-gray-400 text-sm w-5">{isExpanded ? '▼' : '▶'}</span>

                                    <div className="w-28">
                                        <div className="font-semibold text-gray-800">{student.name}</div>
                                        <div className="text-xs text-gray-400 font-mono">{student.phone}</div>
                                    </div>

                                    <div className="w-24">
                                        <div className="text-sm text-gray-600">{student.coach_name || '-'}</div>
                                        <div className="text-xs text-gray-400">{student.day_of_week} {student.start_time?.slice(0, 5) || ''}</div>
                                    </div>

                                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>{status.label}</span>

                                    {isRepayment && <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">🔄 재결제 {student.extension_count}회</span>}

                                    <div className="ml-auto flex items-center gap-4">
                                        <div className="text-right">
                                            <div className="text-xs text-gray-400">종료까지</div>
                                            <div className={`font-medium text-sm ${daysLeft.startsWith('D-') && parseInt(daysLeft.slice(2)) <= 7 ? 'text-red-500' : 'text-gray-600'}`}>
                                                {daysLeft}
                                            </div>
                                        </div>

                                        {isActive && (
                                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                                <button onClick={() => { setBreakStudent(student); setBreakWeeks(1); setBreakReason(''); setBreakModalOpen(true); }} className="px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg text-xs font-medium hover:bg-amber-100">휴강</button>
                                                <button onClick={() => handleCancel(student)} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-lg text-xs font-medium hover:bg-red-100">취소</button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="px-5 py-4 bg-gray-50 border-t">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {/* 기본 정보 */}
                                            <div className="bg-white p-4 rounded-lg border">
                                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                    <span>📋</span> 기본 정보
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">첫 결제일</span>
                                                        <span className="font-medium">{student.first_start_date ? format(new Date(student.first_start_date), 'yyyy.MM.dd') : '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">현재 회차</span>
                                                        <span className="font-medium">
                                                            {student.start_date ? format(new Date(student.start_date), 'M/d') : '-'} ~ {student.end_date ? format(new Date(student.end_date), 'M/d') : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">총 결제 횟수</span>
                                                        <span className="font-medium">{(student.extension_count || 0) + 1}회</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 활동 로그 */}
                                            <div className="bg-white p-4 rounded-lg border">
                                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                    <span>📊</span> 활동 로그
                                                </h4>
                                                {logs.length > 0 ? (
                                                    <div className="space-y-2 max-h-32 overflow-y-auto">
                                                        {logs.slice(0, 5).map(log => (
                                                            <div key={log.id} className="flex items-center gap-2 text-sm">
                                                                <span className="text-xs text-gray-400 w-14">{format(new Date(log.created_at), 'MM.dd')}</span>
                                                                <span className={`px-1.5 py-0.5 rounded text-xs ${log.action_type === 'BREAK' ? 'bg-amber-100 text-amber-700' :
                                                                        log.action_type === 'EXTENSION' ? 'bg-green-100 text-green-700' :
                                                                            log.action_type === 'CANCEL' ? 'bg-red-100 text-red-700' :
                                                                                'bg-gray-100 text-gray-600'
                                                                    }`}>{log.action_type}</span>
                                                                <span className="text-gray-600 truncate">{log.new_value || log.reason || '-'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : <div className="text-sm text-gray-400 py-4 text-center">기록된 활동 없음</div>}
                                            </div>

                                            {/* 메모 */}
                                            <div className="bg-white p-4 rounded-lg border">
                                                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                    <span>📌</span> 특이사항 메모
                                                </h4>
                                                <textarea
                                                    value={memo}
                                                    onChange={(e) => setMemo(e.target.value)}
                                                    placeholder="이 수강생에 대한 메모를 입력하세요..."
                                                    className="w-full text-sm border rounded-lg p-3 h-20 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-300"
                                                />
                                                <button
                                                    onClick={() => saveMemo(student.id)}
                                                    disabled={memoSaving}
                                                    className={`mt-2 w-full py-2 rounded-lg text-sm font-medium transition-colors ${memoSaved
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {memoSaving ? '저장 중...' : memoSaved ? '✅ 저장 완료!' : '💾 메모 저장'}
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
