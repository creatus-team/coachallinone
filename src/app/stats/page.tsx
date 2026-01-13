'use client';

import { useState, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { format, subDays } from 'date-fns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function StatsPage() {
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [showActive, setShowActive] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [showRenewal, setShowRenewal] = useState(false);
    const [showRetention, setShowRetention] = useState(false);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/stats/trend?startDate=${startDate}&endDate=${endDate}`)
            .then(res => res.json())
            .then(res => {
                setData(res.trends || []);
            })
            .finally(() => setLoading(false));
    }, [startDate, endDate]);

    const chartData = {
        labels: data.map(d => format(new Date(d.date), 'MM/dd')),
        datasets: [
            showActive && {
                label: '활성 수강생',
                data: data.map(d => d.active),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4,
                fill: true,
            },
            showNew && {
                label: '신규 등록',
                data: data.map(d => d.new),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
            },
            showRenewal && {
                label: '재결제',
                data: data.map(d => d.renewal),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                fill: true,
            },
            showRetention && {
                label: '재결제율 (%)',
                data: data.map(d => d.retentionRate),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                tension: 0.4,
                yAxisID: 'y1',
            }
        ].filter(Boolean) as any[]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        scales: {
            x: { ticks: { color: '#9ca3af' }, grid: { color: '#f3f4f6' } },
            y: { type: 'linear' as const, display: true, position: 'left' as const, ticks: { color: '#9ca3af' }, grid: { color: '#f3f4f6' } },
            y1: {
                type: 'linear' as const,
                display: showRetention,
                position: 'right' as const,
                grid: { drawOnChartArea: false },
                ticks: { color: '#f59e0b' },
                min: 0,
                max: 100
            },
        },
        plugins: {
            legend: { labels: { color: '#374151' } },
        }
    };

    return (
        <div className="p-8">
            {/* Header */}
            <header className="mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">통계</h1>
                    <p className="text-gray-500 text-sm mt-1">기간별 트렌드 및 성과 분석</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                </div>
            </header>

            {/* Chart Container */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                {/* Metric Toggles */}
                <div className="flex flex-wrap gap-2 mb-6">
                    <button
                        onClick={() => setShowActive(!showActive)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showActive ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        👥 활성 수강생
                    </button>
                    <button
                        onClick={() => setShowNew(!showNew)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showNew ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        🆕 신규 등록
                    </button>
                    <button
                        onClick={() => setShowRenewal(!showRenewal)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showRenewal ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        🔁 재결제
                    </button>
                    <button
                        onClick={() => setShowRetention(!showRetention)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showRetention ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        📈 재결제율
                    </button>
                </div>

                {/* Chart */}
                <div className="h-[350px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-gray-400">
                            데이터 분석 중...
                        </div>
                    ) : (
                        <Line data={chartData} options={chartOptions as any} />
                    )}
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-gray-500 text-xs mb-1">기간 내 총 신규</div>
                    <div className="text-2xl font-bold text-blue-600">{data.reduce((a, b) => a + b.new, 0)}명</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-gray-500 text-xs mb-1">기간 내 총 재결제</div>
                    <div className="text-2xl font-bold text-purple-600">{data.reduce((a, b) => a + b.renewal, 0)}명</div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-gray-500 text-xs mb-1">평균 활성 수</div>
                    <div className="text-2xl font-bold text-emerald-600">
                        {Math.round(data.reduce((a, b) => a + b.active, 0) / (data.length || 1))}명
                    </div>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <div className="text-gray-500 text-xs mb-1">평균 재결제율</div>
                    <div className="text-2xl font-bold text-amber-600">
                        {Math.round(data.reduce((a, b) => a + b.retentionRate, 0) / (data.length || 1))}%
                    </div>
                </div>
            </div>
        </div>
    );
}
