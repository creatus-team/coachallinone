'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StudentSession {
    name: string;
    sessions: number;
}

interface Settlement {
    coachId: number;
    coachName: string;
    coachPhone: string;
    studentCount: number;
    totalSessions: number;
    pricePerSession: number;
    totalAmount: number;
    students: StudentSession[];
}

interface SettlementData {
    year: number;
    month: number;
    settlements: Settlement[];
    grandTotal: number;
}

export default function SettlementsPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [data, setData] = useState<SettlementData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedCoach, setExpandedCoach] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/settlements?year=${year}&month=${month}`)
            .then(res => res.json())
            .then(setData)
            .finally(() => setLoading(false));
    }, [year, month]);

    const formatAmount = (amount: number) => {
        return new Intl.NumberFormat('ko-KR').format(amount);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                        💰 코치 정산
                    </h1>
                    <p className="text-slate-400 mt-1">월별 코칭 횟수 및 정산 금액</p>
                </div>
                <div className="flex gap-3 items-center">
                    {/* Month Selector */}
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <option key={m} value={m}>{m}월</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}년</option>
                        ))}
                    </select>
                    <Link
                        href="/"
                        className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                    >
                        ← 대시보드
                    </Link>
                </div>
            </header>

            {/* Summary Card */}
            {data && (
                <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-xl p-6 mb-8">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-amber-300 text-sm font-medium">{year}년 {month}월 총 정산 예정</div>
                            <div className="text-4xl font-bold text-white mt-1">
                                ₩ {formatAmount(data.grandTotal)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-slate-400 text-sm">활성 코치</div>
                            <div className="text-2xl font-bold text-amber-400">{data.settlements.length}명</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settlements Table */}
            {loading ? (
                <div className="text-center text-slate-500 py-20">로딩 중...</div>
            ) : data && data.settlements.length > 0 ? (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-900/50 text-slate-400">
                            <tr>
                                <th className="px-6 py-4">코치</th>
                                <th className="px-6 py-4 text-center">담당 학생</th>
                                <th className="px-6 py-4 text-center">코칭 횟수</th>
                                <th className="px-6 py-4 text-right">단가</th>
                                <th className="px-6 py-4 text-right">정산액</th>
                                <th className="px-6 py-4 text-center">상세</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {data.settlements.map((settlement) => (
                                <>
                                    <tr key={settlement.coachId} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white">{settlement.coachName}</div>
                                            <div className="text-xs text-slate-500">{settlement.coachPhone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-slate-300">{settlement.studentCount}명</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-sm font-bold">
                                                {settlement.totalSessions}회
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-400">
                                            ₩ {formatAmount(settlement.pricePerSession)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-lg font-bold text-amber-400">
                                                ₩ {formatAmount(settlement.totalAmount)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setExpandedCoach(expandedCoach === settlement.coachId ? null : settlement.coachId)}
                                                className="text-blue-400 hover:text-blue-300 text-xs"
                                            >
                                                {expandedCoach === settlement.coachId ? '접기' : '펼치기'}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedCoach === settlement.coachId && (
                                        <tr className="bg-slate-900/50">
                                            <td colSpan={6} className="px-6 py-4">
                                                <div className="text-xs text-slate-400 mb-2">수강생별 코칭 횟수</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {settlement.students.map((student, idx) => (
                                                        <span key={idx} className="bg-slate-700 px-3 py-1 rounded text-sm">
                                                            {student.name}: <span className="text-emerald-400">{student.sessions}회</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center text-slate-500 py-20 bg-slate-800/50 border border-slate-700 rounded-xl">
                    {year}년 {month}월에 진행된 코칭이 없습니다.
                </div>
            )}
        </div>
    );
}
