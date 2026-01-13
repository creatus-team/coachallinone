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
import Link from 'next/link';
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

    // Metrics Toggle State
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
                borderColor: '#4ade80', // Green 400
                backgroundColor: 'rgba(74, 222, 128, 0.1)',
                tension: 0.4,
                fill: true,
            },
            showNew && {
                label: '신규 등록',
                data: data.map(d => d.new),
                borderColor: '#60a5fa', // Blue 400
                backgroundColor: 'rgba(96, 165, 250, 0.1)',
                tension: 0.4,
                fill: true,
            },
            showRenewal && {
                label: '재결제',
                data: data.map(d => d.renewal),
                borderColor: '#c084fc', // Purple 400
                backgroundColor: 'rgba(192, 132, 252, 0.1)',
                tension: 0.4,
                fill: true,
            },
            showRetention && {
                label: '재결제율 (%)',
                data: data.map(d => d.retentionRate),
                borderColor: '#fbbf24', // Amber 400
                backgroundColor: 'rgba(251, 191, 36, 0.1)',
                tension: 0.4,
                yAxisID: 'y1',
            }
        ].filter(Boolean) as any[]
    };

    const chartOptions = {
        responsive: true,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        scales: {
            x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y: { type: 'linear' as const, display: true, position: 'left' as const, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
            y1: {
                type: 'linear' as const,
                display: showRetention,
                position: 'right' as const,
                grid: { drawOnChartArea: false },
                ticks: { color: '#fbbf24' },
                min: 0,
                max: 100
            },
        },
        plugins: {
            legend: { labels: { color: '#e2e8f0' } },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                titleColor: '#e2e8f0',
                bodyColor: '#cbd5e1',
                borderColor: '#334155',
                borderWidth: 1
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6 md:p-8">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold mb-1">📊 고급 경영 대시보드</h1>
                    <p className="text-slate-400 text-sm">기간별 트렌드 및 성과 분석</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <span className="text-slate-500">~</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                    />
                    <Link href="/" className="ml-4 px-4 py-2 bg-slate-800 text-slate-300 rounded hover:bg-slate-700 text-sm">
                        나가기
                    </Link>
                </div>
            </div>

            {/* Main Chart Container */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl mb-6">
                {/* Metric Toggles */}
                <div className="flex flex-wrap gap-2 mb-6 justify-center md:justify-start">
                    <button
                        onClick={() => setShowActive(!showActive)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showActive ? 'bg-green-500 text-white shadow-lg shadow-green-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    >
                        👥 활성 수강생
                    </button>
                    <button
                        onClick={() => setShowNew(!showNew)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showNew ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    >
                        🆕 신규 등록
                    </button>
                    <button
                        onClick={() => setShowRenewal(!showRenewal)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showRenewal ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    >
                        🔁 재결제
                    </button>
                    <button
                        onClick={() => setShowRetention(!showRetention)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${showRetention ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                    >
                        📈 재결제율
                    </button>
                </div>

                {/* Chart Area */}
                <div className="relative h-[400px] w-full">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                            데이터 분석 중...
                        </div>
                    ) : (
                        <Line data={chartData} options={chartOptions as any} />
                    )}
                </div>
            </div>

            {/* Summary Stats Table (Optional, for quick view) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-400 text-xs">기간 내 총 신규</div>
                    <div className="text-2xl font-bold text-blue-400">{data.reduce((a, b) => a + b.new, 0)}명</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-400 text-xs">기간 내 총 재결제</div>
                    <div className="text-2xl font-bold text-purple-400">{data.reduce((a, b) => a + b.renewal, 0)}명</div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-400 text-xs">평균 활성 수</div>
                    <div className="text-2xl font-bold text-green-400">
                        {Math.round(data.reduce((a, b) => a + b.active, 0) / (data.length || 1))}명
                    </div>
                </div>
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <div className="text-slate-400 text-xs">평균 재결제율</div>
                    <div className="text-2xl font-bold text-amber-400">
                        {Math.round(data.reduce((a, b) => a + b.retentionRate, 0) / (data.length || 1))}%
                    </div>
                </div>
            </div>
        </div>
    );
}
