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
    const [retrying, setRetrying] = useState<number | null>(null);
    const [filter, setFilter] = useState<'all' | 'attention'>('all');

    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/webhooks/logs?limit=100');
            const data = await res.json();
            setLogs(data.logs || []);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRetry = async (rawId: number) => {
        setRetrying(rawId);
        try {
            const res = await fetch('/api/ingest/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rawId })
            });
            const data = await res.json();
            if (data.success) {
                alert('✅ 재처리 성공!');
            } else {
                alert(`❌ 재처리 실패: ${data.error}`);
            }
            fetchLogs();
        } catch (error) {
            alert('❌ 네트워크 오류');
        } finally {
            setRetrying(null);
        }
    };

    const filteredLogs = filter === 'attention'
        ? logs.filter(l => l.status === 'NEEDS_ATTENTION' || l.status === 'FAILED')
        : logs;

    const attentionCount = logs.filter(l => l.status === 'NEEDS_ATTENTION' || l.status === 'FAILED').length;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-2 text-gray-900">📡 데이터 연동 현황</h1>
            <p className="text-gray-500 mb-6">엑셀에서 들어온 모든 데이터를 실시간으로 확인합니다.</p>

            {/* 필터 & 경고 배너 */}
            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    전체 ({logs.length})
                </button>
                <button
                    onClick={() => setFilter('attention')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === 'attention' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                >
                    🚨 처리 필요 ({attentionCount})
                </button>
            </div>

            {attentionCount > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <p className="text-red-800 font-medium">
                        ⚠️ {attentionCount}건의 데이터가 자동 처리에 실패했습니다.
                        확인 후 [재처리] 버튼을 눌러주세요.
                    </p>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-700 font-medium">
                            <tr>
                                <th className="px-4 py-3">ID</th>
                                <th className="px-4 py-3">시간</th>
                                <th className="px-4 py-3">고객명</th>
                                <th className="px-4 py-3">연락처</th>
                                <th className="px-4 py-3">옵션</th>
                                <th className="px-4 py-3">상태</th>
                                <th className="px-4 py-3">오류 내용</th>
                                <th className="px-4 py-3">액션</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredLogs.map((log) => {
                                let payload: any = {};
                                try {
                                    payload = typeof log.payload === 'string' ? JSON.parse(log.payload) : log.payload;
                                } catch (e) {
                                    payload = {};
                                }

                                const needsAttention = log.status === 'NEEDS_ATTENTION' || log.status === 'FAILED';

                                return (
                                    <tr key={log.id} className={`hover:bg-gray-50 transition-colors ${needsAttention ? 'bg-red-50' : ''}`}>
                                        <td className="px-4 py-3 font-mono text-gray-500">#{log.id}</td>
                                        <td className="px-4 py-3 text-gray-600">
                                            {new Date(log.created_at).toLocaleString('ko-KR', {
                                                month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-4 py-3 font-medium">{payload.name || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600">{payload.phone || '-'}</td>
                                        <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate" title={payload.option}>
                                            {payload.option || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {log.status === 'PROCESSED' && (
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">✅ 완료</span>
                                            )}
                                            {log.status === 'RECEIVED' && (
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">📥 수신</span>
                                            )}
                                            {(log.status === 'NEEDS_ATTENTION' || log.status === 'FAILED') && (
                                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">⚠️ 확인필요</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-red-600 max-w-[200px] truncate" title={log.error_log || ''}>
                                            {log.error_log || '-'}
                                        </td>
                                        <td className="px-4 py-3">
                                            {needsAttention && (
                                                <button
                                                    onClick={() => handleRetry(log.id)}
                                                    disabled={retrying === log.id}
                                                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                                                >
                                                    {retrying === log.id ? '처리중...' : '🔄 재처리'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredLogs.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                                        {filter === 'attention' ? '처리가 필요한 데이터가 없습니다. 👍' : '아직 데이터가 없습니다.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
