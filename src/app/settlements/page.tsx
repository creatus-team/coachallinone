'use client';

import { useState, useEffect } from 'react';

interface StudentSession {
    id: number;
    name: string;
    phone: string;
    dayOfWeek: string;
    startTime: string;
    sessionDates: string[];
    sessionCount: number;
    sessionPeriod: { start: string; end: string };
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
    grandTotalSessions: number;
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

    const handleExportCSV = () => {
        if (!data) return;

        const rows: string[] = [];

        // Header
        rows.push('코치명,코치연락처,수강생명,수강생연락처,요일,시간,세션기간,포함회차,세션날짜,단가,정산액');

        // Data rows
        for (const settlement of data.settlements) {
            for (const student of settlement.students) {
                rows.push([
                    settlement.coachName,
                    settlement.coachPhone,
                    student.name,
                    student.phone,
                    student.dayOfWeek,
                    student.startTime,
                    `${student.sessionPeriod.start}~${student.sessionPeriod.end}`,
                    student.sessionCount.toString(),
                    student.sessionDates.join(' / '),
                    settlement.pricePerSession.toString(),
                    (student.sessionCount * settlement.pricePerSession).toString()
                ].join(','));
            }
        }

        // Download
        const csvContent = '\uFEFF' + rows.join('\n'); // BOM for Korean support
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `정산_${year}년${month}월.csv`;
        link.click();
        URL.revokeObjectURL(url);
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
                    <button
                        onClick={handleExportCSV}
                        disabled={!data || data.settlements.length === 0}
                        className="px-4 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        📥 CSV 내보내기
                    </button>
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
                            <div className="text-sm text-gray-500 mt-1">
                                총 {data.grandTotalSessions}회 × ₩35,000
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
                <div className="space-y-4">
                    {data.settlements.map((settlement) => (
                        <div key={settlement.coachId} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            {/* Coach Header Row */}
                            <div
                                className="px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => setExpandedCoach(expandedCoach === settlement.coachId ? null : settlement.coachId)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                                        {settlement.coachName.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-800">{settlement.coachName}</div>
                                        <div className="text-xs text-gray-400">{settlement.coachPhone}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-8">
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">담당 수강생</div>
                                        <div className="font-medium text-gray-800">{settlement.studentCount}명</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500">총 코칭 횟수</div>
                                        <div className="font-bold text-emerald-600">{settlement.totalSessions}회</div>
                                    </div>
                                    <div className="text-right min-w-[120px]">
                                        <div className="text-xs text-gray-500">정산액</div>
                                        <div className="text-lg font-bold text-gray-800">₩ {formatAmount(settlement.totalAmount)}</div>
                                    </div>
                                    <div className="text-gray-400">
                                        {expandedCoach === settlement.coachId ? '▲' : '▼'}
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Detail */}
                            {expandedCoach === settlement.coachId && (
                                <div className="border-t border-gray-100 bg-gray-50">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-200">
                                                <th className="px-6 py-3">수강생</th>
                                                <th className="px-6 py-3">연락처</th>
                                                <th className="px-6 py-3">수업 시간</th>
                                                <th className="px-6 py-3">세션 기간</th>
                                                <th className="px-6 py-3">포함 회차</th>
                                                <th className="px-6 py-3">세션 날짜</th>
                                                <th className="px-6 py-3 text-right">정산액</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {settlement.students.map((student, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-6 py-3 font-medium text-gray-800">{student.name}</td>
                                                    <td className="px-6 py-3 text-gray-600 font-mono text-xs">{student.phone}</td>
                                                    <td className="px-6 py-3 text-gray-600">
                                                        {student.dayOfWeek} {student.startTime}
                                                    </td>
                                                    <td className="px-6 py-3 text-gray-500 text-xs">
                                                        {student.sessionPeriod.start} ~ {student.sessionPeriod.end}
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-xs font-bold">
                                                            {student.sessionCount}회
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-3">
                                                        <div className="flex flex-wrap gap-1">
                                                            {student.sessionDates.map((date, i) => (
                                                                <span key={i} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
                                                                    {date}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-3 text-right font-medium text-gray-800">
                                                        ₩ {formatAmount(student.sessionCount * settlement.pricePerSession)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t border-gray-200">
                                            <tr>
                                                <td colSpan={4} className="px-6 py-3 text-right text-gray-500 text-sm">합계</td>
                                                <td className="px-6 py-3">
                                                    <span className="font-bold text-emerald-600">{settlement.totalSessions}회</span>
                                                </td>
                                                <td className="px-6 py-3 text-xs text-gray-500">
                                                    × ₩{formatAmount(settlement.pricePerSession)}
                                                </td>
                                                <td className="px-6 py-3 text-right font-bold text-gray-800">
                                                    ₩ {formatAmount(settlement.totalAmount)}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center text-gray-400 py-20 bg-white border border-gray-200 rounded-xl">
                    {year}년 {month}월에 진행된 코칭이 없습니다.
                </div>
            )}
        </div>
    );
}
