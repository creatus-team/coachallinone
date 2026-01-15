'use client';

import { useState, useEffect } from 'react';

interface WebhookLog {
    id: number;
    source: string;
    payload: any;
    status: string;
    error_log?: string;
    created_at: string;
    processed_at?: string;
}

export default function SyncStatusPage() {
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/webhooks/logs?limit=50');
            const data = await res.json();
            setLogs(data.logs);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-gray-900">📡 데이터 연동 현황 (Sync Status)</h1>

            <div className="grid gap-6">
                <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold">최근 유입 로그 (실시간)</h2>
                        <button
                            onClick={fetchLogs}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            새로고침
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-700 font-medium">
                                <tr>
                                    <th className="px-4 py-3">ID</th>
                                    <th className="px-4 py-3">시간</th>
                                    <th className="px-4 py-3">출처</th>
                                    <th className="px-4 py-3">고객명/연락처</th>
                                    <th className="px-4 py-3">구분</th>
                                    <th className="px-4 py-3">상태</th>
                                    <th className="px-4 py-3">메세지</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {logs.map((log) => {
                                    let payload: any = {};
                                    try {
                                        payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
                                    } catch (e) {
                                        payload = {};
                                    }

                                    // Use 'type' from payload directly if available, else derive it
                                    const isRepayment = payload.type === 'repayment';

                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 font-mono text-gray-500">#{log.id}</td>
                                            <td className="px-4 py-3">
                                                {new Date(log.created_at).toLocaleString('ko-KR', {
                                                    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                    {log.source === 'google_sheet' ? '엑셀' : log.source}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium">
                                                {payload.name || '-'} <br />
                                                <span className="text-gray-400 font-normal">{payload.phone || '-'}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {isRepayment ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                                        기간 연장
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                        신규 등록
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {log.status === 'PROCESSED' ? (
                                                    <span className="text-green-600 font-bold">✅ 성공</span>
                                                ) : log.status === 'FAILED' ? (
                                                    <span className="text-red-600 font-bold">❌ 실패</span>
                                                ) : (
                                                    <span className="text-yellow-600 font-bold">⏳ 대기</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                                                {log.error_log || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                                {logs.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                                            아직 데이터가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
