'use client';

import { useState, useEffect } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import Link from 'next/link';
import StatsCard from '@/components/StatsCard'; // Assuming you have this or will reuse logic

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

interface StatsData {
    users: {
        total: number;
        active: number;
        pending: number;
        completed: number;
    };
    coaches: Array<{
        name: string;
        totalSlots: number;
        usedSlots: number;
        utilizationRate: number;
    }>;
    monthly: {
        new: number;
        renewal: number;
    };
}

export default function StatsPage() {
    const [data, setData] = useState<StatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/stats')
            .then(res => res.json())
            .then(setData)
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="p-8 text-white">로딩 중...</div>;
    if (!data) return <div className="p-8 text-white">데이터 불러오기 실패</div>;

    // Chart Data: Coach Utilization
    const coachChartData = {
        labels: data.coaches.map(c => c.name),
        datasets: [
            {
                label: '사용 중인 슬롯',
                data: data.coaches.map(c => c.usedSlots),
                backgroundColor: 'rgba(56, 189, 248, 0.8)', // Sky 400
            },
            {
                label: '남은 슬롯',
                data: data.coaches.map(c => c.totalSlots - c.usedSlots),
                backgroundColor: 'rgba(148, 163, 184, 0.5)', // Slate 400
            },
        ],
    };

    const coachChartOptions = {
        responsive: true,
        scales: {
            x: { stacked: true, ticks: { color: '#cbd5e1' } },
            y: { stacked: true, ticks: { color: '#cbd5e1' } },
        },
        plugins: {
            legend: { labels: { color: '#e2e8f0' } },
        },
    };

    // Chart Data: Student Status (Doughnut)
    const userChartData = {
        labels: ['수강중', '대기', '종료'],
        datasets: [
            {
                data: [data.users.active, data.users.pending, data.users.completed],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',  // Green
                    'rgba(234, 179, 8, 0.8)',  // Yellow
                    'rgba(100, 116, 139, 0.8)', // Slate
                ],
                borderWidth: 0,
            },
        ],
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold mb-2">📊 경영 대시보드</h1>
                    <p className="text-slate-400">실시간 운영 지표 및 통계</p>
                </div>
                <Link
                    href="/"
                    className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
                >
                    ← 메인으로
                </Link>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-sm mb-2">총 활성 수강생</h3>
                    <p className="text-3xl font-bold text-green-400">{data.users.active}명</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-sm mb-2">이번 달 신규</h3>
                    <p className="text-3xl font-bold text-blue-400">+{data.monthly.new}건</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-sm mb-2">이번 달 재결제</h3>
                    <p className="text-3xl font-bold text-purple-400">+{data.monthly.renewal}건</p>
                </div>
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-slate-400 text-sm mb-2">전체 가동률</h3>
                    <p className="text-3xl font-bold text-amber-400">
                        {Math.round(
                            (data.coaches.reduce((acc, c) => acc + c.usedSlots, 0) /
                                data.coaches.reduce((acc, c) => acc + c.totalSlots, 0)) * 100
                        ) || 0}%
                    </p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

                {/* Coach Utilization Bar Chart */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-bold mb-4">🧢 코치별 슬롯 현황</h3>
                    <Bar data={coachChartData} options={coachChartOptions} />
                </div>

                {/* User Status Doughnut & Table */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-lg font-bold mb-4">👥 수강생 상태 분포</h3>
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="w-48 h-48">
                            <Doughnut data={userChartData} options={{ plugins: { legend: { display: false } } }} />
                        </div>
                        <div className="flex-1 w-full">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-slate-400 border-b border-slate-700">
                                        <th className="text-left py-2">상태</th>
                                        <th className="text-right py-2">인원</th>
                                        <th className="text-right py-2">비율</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { label: '수강중', val: data.users.active, color: 'text-green-400' },
                                        { label: '대기', val: data.users.pending, color: 'text-yellow-400' },
                                        { label: '종료', val: data.users.completed, color: 'text-slate-400' }
                                    ].map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-700 last:border-0">
                                            <td className={`py-3 font-medium ${row.color}`}>{row.label}</td>
                                            <td className="text-right py-3">{row.val}명</td>
                                            <td className="text-right py-3 text-slate-500">
                                                {Math.round((row.val / data.users.total) * 100) || 0}%
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
