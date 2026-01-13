import { query } from '@/lib/db';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getStudentDetail(id: string) {
    try {
        // 기본 정보
        const userRes = await query(`
            SELECT u.*, 
                s.id as session_id,
                s.coach_id,
                s.day_of_week,
                s.start_time,
                s.start_date,
                s.end_date,
                c.name as coach_name,
                c.phone as coach_phone
            FROM users u
            LEFT JOIN sessions s ON u.id = s.user_id
            LEFT JOIN coaches c ON s.coach_id = c.id
            WHERE u.id = $1
        `, [id]);

        if (userRes.rows.length === 0) return null;

        const user = userRes.rows[0];

        // 활동 로그 (발송 이력)
        const logsRes = await query(`
            SELECT * FROM message_logs
            WHERE recipient_phone = $1 OR recipient_name = $2
            ORDER BY sent_at DESC
            LIMIT 20
        `, [user.phone, user.name]);

        // 휴강 이력
        const breaksRes = await query(`
            SELECT * FROM session_breaks
            WHERE session_id = $1
            ORDER BY created_at DESC
        `, [user.session_id || 0]);

        return {
            user,
            logs: logsRes.rows,
            breaks: breaksRes.rows
        };
    } catch (e: any) {
        console.error('Error:', e.message);
        return null;
    }
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const data = await getStudentDetail(id);

    if (!data) {
        notFound();
    }

    const { user, logs, breaks } = data;

    // 세션 상태 계산
    const today = new Date();
    let sessionStatus = '미배정';
    if (user.start_date && user.end_date) {
        const start = new Date(user.start_date);
        const end = new Date(user.end_date);
        if (start > today) sessionStatus = '대기';
        else if (end < today) sessionStatus = '종료';
        else sessionStatus = '진행 중';
    }

    return (
        <div className="p-8">
            {/* Header */}
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <Link href="/students" className="text-gray-400 hover:text-gray-600 text-sm">
                        ← 수강생 목록
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800 mt-2">{user.name}</h1>
                    <p className="text-gray-500 text-sm">{user.phone}</p>
                </div>
                <div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${sessionStatus === '진행 중' ? 'bg-emerald-100 text-emerald-600' :
                            sessionStatus === '대기' ? 'bg-amber-100 text-amber-600' :
                                sessionStatus === '종료' ? 'bg-gray-100 text-gray-500' :
                                    'bg-gray-100 text-gray-500'
                        }`}>
                        {sessionStatus}
                    </span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 기본 정보 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">📋 기본 정보</h2>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <dt className="text-gray-500">이름</dt>
                            <dd className="font-medium text-gray-800">{user.name}</dd>
                        </div>
                        <div>
                            <dt className="text-gray-500">연락처</dt>
                            <dd className="font-medium text-gray-800 font-mono">{user.phone}</dd>
                        </div>
                        <div>
                            <dt className="text-gray-500">등록일</dt>
                            <dd className="font-medium text-gray-800">
                                {user.created_at ? format(new Date(user.created_at), 'yyyy.MM.dd') : '-'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-gray-500">상품 유형</dt>
                            <dd className="font-medium text-gray-800">{user.product_type || '-'}</dd>
                        </div>
                    </dl>
                </div>

                {/* 코칭 정보 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">🧢 코칭 정보</h2>
                    {user.coach_name ? (
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-gray-500">담당 코치</dt>
                                <dd className="font-medium text-gray-800">{user.coach_name}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">코치 연락처</dt>
                                <dd className="font-medium text-gray-800 font-mono">{user.coach_phone}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">수업 시간</dt>
                                <dd className="font-medium text-gray-800">{user.day_of_week} {user.start_time}</dd>
                            </div>
                            <div>
                                <dt className="text-gray-500">코칭 기간</dt>
                                <dd className="font-medium text-gray-800">
                                    {user.start_date ? format(new Date(user.start_date), 'M/d') : '-'} ~ {user.end_date ? format(new Date(user.end_date), 'M/d') : '-'}
                                </dd>
                            </div>
                        </dl>
                    ) : (
                        <div className="text-center text-gray-400 py-6">코치가 배정되지 않았습니다</div>
                    )}
                </div>

                {/* 휴강 이력 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">⏸️ 휴강 이력</h2>
                    {breaks.length > 0 ? (
                        <div className="space-y-2">
                            {breaks.map((b: any) => (
                                <div key={b.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
                                    <div>
                                        <span className="font-medium text-amber-800">{b.break_weeks}주 휴강</span>
                                        <span className="text-amber-600 text-sm ml-2">{b.reason || '사유 없음'}</span>
                                    </div>
                                    <span className="text-amber-500 text-xs">
                                        {b.created_at ? format(new Date(b.created_at), 'yy.MM.dd') : '-'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-6">휴강 이력 없음</div>
                    )}
                </div>

                {/* 결제 정보 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">💳 결제 정보</h2>
                    <dl className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <dt className="text-gray-500">최초 결제일</dt>
                            <dd className="font-medium text-gray-800">
                                {user.created_at ? format(new Date(user.created_at), 'yyyy.MM.dd') : '-'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-gray-500">수강 종료일</dt>
                            <dd className="font-medium text-gray-800">
                                {user.end_date ? format(new Date(user.end_date), 'yyyy.MM.dd') : '-'}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-gray-500">재결제 여부</dt>
                            <dd className="font-medium text-gray-800">
                                {/* 추후 구현 필요 */}
                                -
                            </dd>
                        </div>
                        <div>
                            <dt className="text-gray-500">상태</dt>
                            <dd className={`font-medium ${sessionStatus === '진행 중' ? 'text-emerald-600' :
                                    sessionStatus === '종료' ? 'text-gray-500' : 'text-amber-600'
                                }`}>
                                {sessionStatus}
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>

            {/* 활동 로그 */}
            <div className="bg-white rounded-xl border border-gray-200 mt-6">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">📝 활동 로그 (발송 이력)</h2>
                </div>
                {logs.length > 0 ? (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100 bg-gray-50">
                                <th className="px-6 py-3">시간</th>
                                <th className="px-6 py-3">유형</th>
                                <th className="px-6 py-3">내용</th>
                                <th className="px-6 py-3">상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {logs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                                        {log.sent_at ? format(new Date(log.sent_at), 'MM/dd HH:mm') : '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-xs">
                                            {log.type || '알림'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600 max-w-xs truncate">{log.content}</td>
                                    <td className="px-6 py-4">
                                        {log.status === 'FAILED' ? (
                                            <span className="text-red-500 text-xs">실패</span>
                                        ) : (
                                            <span className="text-emerald-500 text-xs">성공</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center text-gray-400 py-12">발송 이력이 없습니다</div>
                )}
            </div>
        </div>
    );
}
