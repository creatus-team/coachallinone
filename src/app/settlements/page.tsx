'use client';

import { useState, useEffect } from 'react';

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
        <div className="p-8">
            {/* Header */}
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">정산</h1>
                    <p className="text-gray-500 text-sm mt-1">월별 코칭 횟수 및 정산 금액</p>
                </div>
                <div className="flex gap-3 items-center">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <option key={m} value={m}>{m}월</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        {[2024, 2025, 2026, 2027].map(y => (
                            <option key={y} value={y}>{y}년</option>
                        ))}
                    </select>
                </div>
            </header>

            {/* Summary Card */}
            {data && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="text-emerald-600 text-sm font-medium">{year}년 {month}월 총 정산 예정</div>
                            <div className="text-3xl font-bold text-gray-800 mt-1">
                                ₩ {formatAmount(data.grandTotal)}
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-gray-500 text-sm">활성 코치</div>
                            <div className="text-2xl font-bold text-emerald-600">{data.settlements.length}명</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Settlements Table */}
            {loading ? (
                <div className="text-center text-gray-400 py-20">로딩 중...</div>
            ) : data && data.settlements.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                                <th className="px-6 py-3">코치</th>
                                <th className="px-6 py-3 text-center">담당 학생</th>
                                <th className="px-6 py-3 text-center">코칭 횟수</th>
                                <th className="px-6 py-3 text-right">단가</th>
                                <th className="px-6 py-3 text-right">정산액</th>
                                <th className="px-6 py-3 text-center">상세</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {data.settlements.map((settlement) => (
                                <>
                                    <tr key={settlement.coachId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-800">{settlement.coachName}</div>
                                            <div className="text-xs text-gray-400">{settlement.coachPhone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-600">{settlement.studentCount}명</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold">
                                                {settlement.totalSessions}회
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-gray-500">
                                            ₩ {formatAmount(settlement.pricePerSession)}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-lg font-bold text-gray-800">
                                                ₩ {formatAmount(settlement.totalAmount)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setExpandedCoach(expandedCoach === settlement.coachId ? null : settlement.coachId)}
                                                className="text-emerald-600 hover:underline text-xs"
                                            >
                                                {expandedCoach === settlement.coachId ? '접기' : '펼치기'}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedCoach === settlement.coachId && (
                                        <tr className="bg-gray-50">
                                            <td colSpan={6} className="px-6 py-4">
                                                <div className="text-xs text-gray-500 mb-2">수강생별 코칭 횟수</div>
                                                <div className="flex flex-wrap gap-2">
                                                    {settlement.students.map((student, idx) => (
                                                        <span key={idx} className="bg-white border border-gray-200 px-3 py-1 rounded text-sm">
                                                            {student.name}: <span className="text-emerald-600 font-medium">{student.sessions}회</span>
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
                <div className="text-center text-gray-400 py-20 bg-white border border-gray-200 rounded-xl">
                    {year}년 {month}월에 진행된 코칭이 없습니다.
                </div>
            )}
        </div>
    );
}
