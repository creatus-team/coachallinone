import { query } from '@/lib/db';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import StudentMemo from './StudentMemo';

export const dynamic = 'force-dynamic';

async function getStudentDetail(id: string) {
    try {
        // 기본 정보 + 확장 정보
        const userRes = await query(`
            SELECT u.*, 
                s.id as session_id,
                s.coach_id,
                s.day_of_week,
                s.start_time,
                s.start_date,
                s.end_date,
                s.extension_count,
                c.name as coach_name,
                c.phone as coach_phone,
                (SELECT MIN(start_date) FROM sessions WHERE user_id = u.id) as first_start_date,
                (SELECT COUNT(*) FROM sessions WHERE user_id = u.id) as total_sessions
            FROM users u
            LEFT JOIN LATERAL (
                SELECT * FROM sessions WHERE user_id = u.id ORDER BY end_date DESC LIMIT 1
            ) s ON true
            LEFT JOIN coaches c ON s.coach_id = c.id
            WHERE u.id = $1
        `, [id]);

        if (userRes.rows.length === 0) return null;

        const user = userRes.rows[0];

        // 활동 로그
        const activityRes = await query(`
            SELECT * FROM user_activity_logs
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [id]);

        // 휴강 이력
        const breaksRes = await query(`
            SELECT * FROM session_breaks
            WHERE session_id = $1
            ORDER BY created_at DESC
        `, [user.session_id || 0]);

        // 메모
        const memoRes = await query(`
            SELECT * FROM user_memos
            WHERE user_id = $1
            LIMIT 1
        `, [id]);

        // 세션 이력 (코치/시간대 변경 추적용)
        const sessionsRes = await query(`
            SELECT s.*, c.name as coach_name 
            FROM sessions s 
            LEFT JOIN coaches c ON s.coach_id = c.id
            WHERE s.user_id = $1 
            ORDER BY s.start_date DESC
        `, [id]);

        return {
            user,
            activityLogs: activityRes.rows,
            breaks: breaksRes.rows,
            memo: memoRes.rows[0] || null,
            sessions: sessionsRes.rows
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

    const { user, activityLogs, breaks, memo, sessions } = data;

    // 세션 상태 계산
    const today = new Date();
    let sessionStatus = '미배정';
    if (user.start_date && user.end_date) {
        const start = new Date(user.start_date);
        const end = new Date(user.end_date);
        if (start > today) sessionStatus = '대기';
        else if (end < today) sessionStatus = '종료';
        else sessionStatus = '진행중';
    }

    const isRepayment = (user.extension_count || 0) > 0;

    return (
        <div className="p-8 max-w-6xl">
            {/* Header */}
            <header className="mb-6 flex justify-between items-center">
                <div>
                    <Link href="/students" className="text-gray-400 hover:text-gray-600 text-sm">
                        ← 수강생 목록
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-800 mt-2 flex items-center gap-3">
                        {user.name}
                        {isRepayment && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded font-medium">
                                🔄 재결제 {user.extension_count}회
                            </span>
                        )}
                    </h1>
                    <p className="text-gray-500 text-sm font-mono">{user.phone}</p>
                </div>
                <div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${sessionStatus === '진행중' ? 'bg-emerald-100 text-emerald-600' :
                            sessionStatus === '대기' ? 'bg-amber-100 text-amber-600' :
                                'bg-gray-100 text-gray-500'
                        }`}>
                        {sessionStatus}
                    </span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 기본 정보 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">📋 기본 정보</h2>
                    <dl className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-gray-500">첫 결제일</dt>
                            <dd className="font-medium text-gray-800">
                                {user.first_start_date ? format(new Date(user.first_start_date), 'yyyy.MM.dd') : '-'}
                            </dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">총 결제 횟수</dt>
                            <dd className="font-medium text-gray-800">{user.total_sessions || 1}회</dd>
                        </div>
                        <div className="flex justify-between">
                            <dt className="text-gray-500">가입일</dt>
                            <dd className="font-medium text-gray-800">
                                {user.created_at ? format(new Date(user.created_at), 'yyyy.MM.dd') : '-'}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* 코칭 정보 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">🧢 현재 코칭</h2>
                    {user.coach_name ? (
                        <dl className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-gray-500">담당 코치</dt>
                                <dd className="font-medium text-gray-800">{user.coach_name}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500">수업 시간</dt>
                                <dd className="font-medium text-gray-800">{user.day_of_week} {user.start_time}</dd>
                            </div>
                            <div className="flex justify-between">
                                <dt className="text-gray-500">현재 회차</dt>
                                <dd className="font-medium text-gray-800">
                                    {user.start_date ? format(new Date(user.start_date), 'M/d') : '-'} ~ {user.end_date ? format(new Date(user.end_date), 'M/d') : '-'}
                                </dd>
                            </div>
                        </dl>
                    ) : (
                        <div className="text-center text-gray-400 py-4">코치 미배정</div>
                    )}
                </div>

                {/* 휴강 이력 */}
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                    <h2 className="font-semibold text-gray-800 mb-4">⏸️ 휴강 이력</h2>
                    {breaks.length > 0 ? (
                        <div className="space-y-2">
                            {breaks.slice(0, 3).map((b: any) => (
                                <div key={b.id} className="p-2 bg-amber-50 rounded border border-amber-200 text-sm">
                                    <span className="font-medium text-amber-800">{b.break_weeks}주</span>
                                    <span className="text-amber-600 ml-2">{b.reason || '-'}</span>
                                    <span className="text-amber-400 text-xs float-right">
                                        {b.created_at ? format(new Date(b.created_at), 'yy.MM.dd') : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-4">없음</div>
                    )}
                </div>
            </div>

            {/* 세션 변경 이력 */}
            <div className="bg-white rounded-xl border border-gray-200 mt-6">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">📊 코칭 이력 (코치/시간대 변화)</h2>
                </div>
                {sessions.length > 0 ? (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-500 text-xs uppercase border-b border-gray-100 bg-gray-50">
                                <th className="px-6 py-3">기간</th>
                                <th className="px-6 py-3">코치</th>
                                <th className="px-6 py-3">시간대</th>
                                <th className="px-6 py-3">연장</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {sessions.map((s: any, idx: number) => (
                                <tr key={s.id} className={idx === 0 ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                                    <td className="px-6 py-3 text-gray-600">
                                        {s.start_date ? format(new Date(s.start_date), 'yy.MM.dd') : '-'} ~ {s.end_date ? format(new Date(s.end_date), 'MM.dd') : '-'}
                                    </td>
                                    <td className="px-6 py-3 font-medium text-gray-800">{s.coach_name || '-'}</td>
                                    <td className="px-6 py-3 text-gray-600">{s.day_of_week} {s.start_time}</td>
                                    <td className="px-6 py-3">
                                        {s.extension_count > 0 && (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">+{s.extension_count}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="text-center text-gray-400 py-8">세션 기록 없음</div>
                )}
            </div>

            {/* 활동 로그 */}
            <div className="bg-white rounded-xl border border-gray-200 mt-6">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-800">📝 활동 로그</h2>
                </div>
                {activityLogs.length > 0 ? (
                    <div className="divide-y divide-gray-50">
                        {activityLogs.map((log: any) => (
                            <div key={log.id} className="px-6 py-3 flex items-center gap-4">
                                <span className="text-xs text-gray-400 w-24">
                                    {log.created_at ? format(new Date(log.created_at), 'MM.dd HH:mm') : '-'}
                                </span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.action_type === 'BREAK' ? 'bg-amber-100 text-amber-700' :
                                        log.action_type === 'COACH_CHANGE' ? 'bg-blue-100 text-blue-700' :
                                            log.action_type === 'TIME_CHANGE' ? 'bg-purple-100 text-purple-700' :
                                                log.action_type === 'CANCEL' ? 'bg-red-100 text-red-700' :
                                                    log.action_type === 'EXTENSION' ? 'bg-green-100 text-green-700' :
                                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                    {log.action_type === 'BREAK' ? '휴강' :
                                        log.action_type === 'COACH_CHANGE' ? '코치변경' :
                                            log.action_type === 'TIME_CHANGE' ? '시간변경' :
                                                log.action_type === 'CANCEL' ? '취소' :
                                                    log.action_type === 'EXTENSION' ? '기간연장' :
                                                        log.action_type}
                                </span>
                                <span className="text-sm text-gray-600 flex-1">
                                    {log.old_value && log.new_value ? (
                                        <>{log.old_value} → {log.new_value}</>
                                    ) : log.new_value || log.reason || '-'}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">아직 기록된 활동이 없습니다</div>
                )}
            </div>

            {/* 특이사항 메모 */}
            <StudentMemo userId={id} initialMemo={memo?.content || ''} />
        </div>
    );
}
