'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface MessageLog {
    id: number;
    type: string;
    recipient_name: string;
    recipient_phone: string;
    content: string;
    status: string;
    sent_at: string;
}

interface ScheduledMessage {
    type: string;
    targetDate: string;
    studentName: string;
    studentPhone: string;
    coachName: string;
    time: string;
}

interface Stats {
    sent_count: number;
    failed_count: number;
    today_count: number;
}

export default function MessagesPage() {
    const [logs, setLogs] = useState<MessageLog[]>([]);
    const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');

    const fetchData = async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (typeFilter) params.set('type', typeFilter);
        if (statusFilter) params.set('status', statusFilter);
        params.set('includeScheduled', 'true');
        params.set('limit', '100');

        const res = await fetch(`/api/messages?${params.toString()}`);
        const data = await res.json();
        setLogs(data.logs || []);
        setScheduled(data.scheduled || []);
        setStats(data.stats || null);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, [typeFilter, statusFilter]);

    const getTypeColor = (type: string) => {
        const colors: Record<string, string> = {
            'NEW': 'bg-blue-50 text-blue-600',
            'RENEWAL': 'bg-purple-50 text-purple-600',
            'D-2': 'bg-amber-50 text-amber-600',
            'D-1': 'bg-orange-50 text-orange-600',
            'ADMIN': 'bg-gray-100 text-gray-600',
            'CANCEL_REQUEST': 'bg-red-50 text-red-600',
        };
        return colors[type] || 'bg-gray-100 text-gray-600';
    };

    return (
        <div className="p-8">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">문자 현황</h1>
                <p className="text-gray-500 text-sm mt-1">발송 완료/실패/예정 문자 조회</p>
            </header>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-gray-500 text-xs mb-1">총 발송 성공</div>
                        <div className="text-2xl font-bold text-emerald-600">{stats.sent_count}건</div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-gray-500 text-xs mb-1">발송 실패</div>
                        <div className="text-2xl font-bold text-red-600">{stats.failed_count}건</div>
                    </div>
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="text-gray-500 text-xs mb-1">오늘 발송</div>
                        <div className="text-2xl font-bold text-blue-600">{stats.today_count}건</div>
                    </div>
                </div>
            )}

            {/* Scheduled Reminders */}
            {scheduled.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
                    <h2 className="font-semibold text-amber-700 mb-3">📅 예정된 리마인더</h2>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-amber-600 text-xs uppercase">
                                <th className="px-3 py-2">타입</th>
                                <th className="px-3 py-2">수업일</th>
                                <th className="px-3 py-2">수강생</th>
                                <th className="px-3 py-2">코치</th>
                                <th className="px-3 py-2">시간</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scheduled.map((s, i) => (
                                <tr key={i} className="border-t border-amber-200">
                                    <td className="px-3 py-2">
                                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-bold">
                                            {s.type}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2 text-amber-800">{s.targetDate}</td>
                                    <td className="px-3 py-2 text-amber-800">{s.studentName}</td>
                                    <td className="px-3 py-2 text-amber-700">{s.coachName}</td>
                                    <td className="px-3 py-2 text-amber-700">{s.time}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 mb-6">
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="">전체 타입</option>
                    <option value="NEW">신규 등록</option>
                    <option value="RENEWAL">재결제</option>
                    <option value="D-2">D-2 리마인더</option>
                    <option value="D-1">D-1 리마인더</option>
                    <option value="ADMIN">관리자</option>
                    <option value="CANCEL_REQUEST">취소 요청</option>
                </select>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                    <option value="">전체 상태</option>
                    <option value="SENT">발송 성공</option>
                    <option value="FAILED">발송 실패</option>
                    <option value="PENDING">대기</option>
                </select>
            </div>

            {/* Logs Table */}
            {loading ? (
                <div className="text-center text-gray-400 py-20">로딩 중...</div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                                <th className="px-6 py-3">시간</th>
                                <th className="px-6 py-3">타입</th>
                                <th className="px-6 py-3">수신자</th>
                                <th className="px-6 py-3">내용</th>
                                <th className="px-6 py-3">상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-gray-500 text-xs font-mono">
                                        {format(new Date(log.sent_at), 'MM/dd HH:mm')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(log.type)}`}>
                                            {log.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-gray-800">{log.recipient_name}</div>
                                        <div className="text-xs text-gray-400">{log.recipient_phone}</div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{log.content}</td>
                                    <td className="px-6 py-4">
                                        {log.status === 'SENT' ? (
                                            <span className="text-emerald-500 text-xs">✅ 성공</span>
                                        ) : log.status === 'FAILED' ? (
                                            <span className="text-red-500 text-xs">❌ 실패</span>
                                        ) : (
                                            <span className="text-amber-500 text-xs">⏳ 대기</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                                        발송 기록이 없습니다.
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
