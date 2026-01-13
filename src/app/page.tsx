import { query } from '@/lib/db';
import { format } from 'date-fns';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

async function getStats() {
  try {
    // Active users = users with an ongoing session (start_date <= today <= end_date)
    const userCountRes = await query(`
      SELECT COUNT(DISTINCT user_id) FROM sessions 
      WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE
    `);
    const logcountRes = await query('SELECT COUNT(*) FROM message_logs WHERE sent_at > CURRENT_DATE');

    const logsRes = await query(`
      SELECT * FROM message_logs 
      ORDER BY sent_at DESC 
      LIMIT 10
    `);

    return {
      activeUsers: userCountRes.rows[0].count,
      sentToday: logcountRes.rows[0].count,
      recentLogs: logsRes.rows,
      error: null
    };
  } catch (e: any) {
    console.error('DB Error:', e);
    return { error: 'Database Connection Failed', activeUsers: 0, sentToday: 0, recentLogs: [] };
  }
}

export default async function DashboardPage() {
  const stats = await getStats();

  return (
    <div className="p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">홈</h1>
        <p className="text-gray-500 text-sm mt-1">실시간 시스템 모니터링</p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">활성 수강생</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.activeUsers}</p>
            </div>
            <span className="text-2xl">👥</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">오늘 발송 건수</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{stats.sentToday}</p>
            </div>
            <span className="text-2xl">✉️</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm">시스템 상태</p>
              <p className="text-lg font-medium mt-1">
                {stats.error ? (
                  <span className="text-red-500">오프라인 🔴</span>
                ) : (
                  <span className="text-emerald-500">정상 🟢</span>
                )}
              </p>
            </div>
            <span className="text-2xl">⚡</span>
          </div>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800">실시간 발송 로그</h2>
          <span className="text-xs text-gray-400">최근 10건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-3">시간</th>
                <th className="px-6 py-3">구분</th>
                <th className="px-6 py-3">수신자</th>
                <th className="px-6 py-3">내용</th>
                <th className="px-6 py-3">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.recentLogs.length > 0 ? (
                stats.recentLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">
                      {format(new Date(log.sent_at), 'HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-emerald-50 text-emerald-600 px-2 py-1 rounded text-xs font-medium">
                        {log.type || '알림'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{log.recipient_name || log.recipient}</td>
                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{log.content}</td>
                    <td className="px-6 py-4">
                      {log.status === 'FAILED' ? (
                        <span className="text-red-500 text-xs">실패</span>
                      ) : (
                        <span className="text-emerald-500 text-xs">성공</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                    오늘 발송된 메시지가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
