'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Alert {
    id: number;
    type: string;
    recipient_name: string;
    recipient_phone: string;
    content: string;
    status: string;
    sent_at: string;
}

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAlerts = async () => {
        try {
            const res = await fetch('/api/alerts');
            const data = await res.json();
            if (data.success) {
                setAlerts(data.alerts);
            }
        } catch (e) {
            console.error('Fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const handleResolve = async (alertId: number) => {
        try {
            const res = await fetch('/api/alerts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: alertId, status: 'RESOLVED' })
            });
            const data = await res.json();
            if (data.success) {
                fetchAlerts();
            }
        } catch (e) {
            console.error('Resolve error:', e);
        }
    };

    const pendingAlerts = alerts.filter(a => a.status === 'PENDING');
    const resolvedAlerts = alerts.filter(a => a.status !== 'PENDING');

    return (
        <div className="p-8">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-gray-800">🚨 관리자 알림</h1>
                <p className="text-gray-500 text-sm mt-1">시스템 오류 및 주의 필요 항목</p>
            </header>

            {/* Pending Alerts */}
            <div className="mb-8">
                <h2 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                    미처리 알림 ({pendingAlerts.length})
                </h2>

                {loading ? (
                    <div className="text-center text-gray-400 py-12">로딩 중...</div>
                ) : pendingAlerts.length > 0 ? (
                    <div className="space-y-4">
                        {pendingAlerts.map((alert) => (
                            <div key={alert.id} className="bg-red-50 border border-red-200 rounded-xl p-5">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-medium">
                                            {alert.type}
                                        </span>
                                        <span className="ml-2 text-gray-600 font-medium">{alert.recipient_name}</span>
                                        <span className="ml-2 text-gray-400 text-sm font-mono">{alert.recipient_phone}</span>
                                    </div>
                                    <span className="text-gray-400 text-xs">
                                        {alert.sent_at ? format(new Date(alert.sent_at), 'MM/dd HH:mm') : '-'}
                                    </span>
                                </div>
                                <div className="text-gray-700 whitespace-pre-wrap text-sm bg-white rounded-lg p-3 border border-red-100">
                                    {alert.content}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={() => handleResolve(alert.id)}
                                        className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                                    >
                                        ✓ 처리 완료
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
                        <span className="text-4xl">✅</span>
                        <p className="text-emerald-600 font-medium mt-2">미처리 알림 없음</p>
                    </div>
                )}
            </div>

            {/* Resolved Alerts */}
            <div>
                <h2 className="text-lg font-semibold text-gray-600 mb-4">
                    처리 완료 ({resolvedAlerts.length})
                </h2>

                {resolvedAlerts.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                                    <th className="px-6 py-3">시간</th>
                                    <th className="px-6 py-3">유형</th>
                                    <th className="px-6 py-3">대상</th>
                                    <th className="px-6 py-3">내용</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {resolvedAlerts.slice(0, 20).map((alert) => (
                                    <tr key={alert.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-gray-500 text-xs font-mono">
                                            {alert.sent_at ? format(new Date(alert.sent_at), 'MM/dd HH:mm') : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-xs">
                                                {alert.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{alert.recipient_name}</td>
                                        <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{alert.content}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">처리된 알림 없음</div>
                )}
            </div>
        </div>
    );
}
