'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface WebhookLog {
    id: number;
    source: string;
    payload: any;
    status: string;
    error_log: string;
    created_at: string;
    processed_at: string;
}

export default function WebhooksPage() {
    const [logs, setLogs] = useState<WebhookLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const fetchLogs = async (pageNum: number) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/webhooks/raw?page=${pageNum}&limit=20`);
            const data = await res.json();
            setLogs(data.data);
            setTotalPages(data.pagination.totalPages);
            setPage(data.pagination.page);
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(page);
    }, [page]);

    const toggleExpand = (id: number) => {
        setExpandedId(expandedId === id ? null : id);
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">📦 웹훅 원본 로그 (Raw Data)</h1>
                <button
                    onClick={() => fetchLogs(page)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                >
                    새로고침
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 w-20">ID</th>
                                <th className="px-6 py-3 w-40">수신 시간</th>
                                <th className="px-6 py-3 w-32">출처</th>
                                <th className="px-6 py-3 w-32">상태</th>
                                <th className="px-6 py-3">Payload (원본)</th>
                                <th className="px-6 py-3 w-24">상세</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        로딩 중...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        데이터가 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <>
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-gray-500">#{log.id}</td>
                                            <td className="px-6 py-4 text-gray-700">
                                                {format(new Date(log.created_at), 'MM/dd HH:mm:ss')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                    {log.source}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={log.status} />
                                            </td>
                                            <td className="px-6 py-4 max-w-md truncate font-mono text-xs text-gray-500">
                                                {JSON.stringify(log.payload)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => toggleExpand(log.id)}
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                                                >
                                                    {expandedId === log.id ? '접기' : '보기'}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedId === log.id && (
                                            <tr className="bg-gray-50">
                                                <td colSpan={6} className="px-6 py-4">
                                                    <div className="space-y-4">
                                                        {log.error_log && (
                                                            <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-100 text-xs font-mono whitespace-pre-wrap">
                                                                <strong>Error Log:</strong><br />
                                                                {log.error_log}
                                                            </div>
                                                        )}
                                                        <div className="bg-gray-800 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-xs font-mono">
                                                            <pre>{JSON.stringify(log.payload, null, 2)}</pre>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
                        >
                            이전
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
                        >
                            다음
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'PROCESSED') {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">성공</span>;
    }
    if (status === 'FAILED') {
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">실패</span>;
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">대기중</span>;
}
