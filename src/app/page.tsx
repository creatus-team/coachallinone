import { query } from '@/lib/db';
import { format } from 'date-fns';
import Link from 'next/link';

// Force dynamic rendering to ensure real-time data
export const dynamic = 'force-dynamic';

async function getStats() {
  // 1. Check DB Connection & Basic Stats
  try {
    const userCountRes = await query('SELECT COUNT(*) FROM users WHERE status = $1', ['active']);
    const logcountRes = await query('SELECT COUNT(*) FROM message_logs WHERE sent_at > CURRENT_DATE');

    // Fetch recent logs
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
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <header className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            크리투스 코칭 관제센터
          </h1>
          <p className="text-slate-400 mt-1">실시간 시스템 모니터링</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link
            href="/coaches/manage"
            className="px-4 py-2 bg-purple-500/20 text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-500/30 transition-colors border border-purple-500/20"
          >
            🧢 코치
          </Link>
          <Link
            href="/slots"
            className="px-4 py-2 bg-amber-500/20 text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors border border-amber-500/20"
          >
            ⏰ 슬롯
          </Link>
          <Link
            href="/students"
            className="px-4 py-2 bg-cyan-500/20 text-cyan-300 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition-colors border border-cyan-500/20"
          >
            👥 수강생
          </Link>
          <Link
            href="/coaches"
            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
          >
            👀 현황
          </Link>
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${stats.error ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'} border border-white/5`}>
            {stats.error ? '오프라인 🔴' : '정상 🟢'}
          </span>
        </div>
      </header>


      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatsCard title="활성 수강생" value={stats.activeUsers} icon="👥" />
        <StatsCard title="오늘 발송 건수" value={stats.sentToday} icon="📨" />
        <StatsCard title="다음 실행" value="42분 후" icon="⏱️" sub="매 시간 체크" />
      </div>

      {/* Logs Section */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden backdrop-blur-sm">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-200">실시간 발송 로그</h2>
          <button className="text-xs text-slate-400 hover:text-white transition-colors">전체 보기</button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
              <tr>
                <th className="px-6 py-3">시간</th>
                <th className="px-6 py-3">구분</th>
                <th className="px-6 py-3">수신자</th>
                <th className="px-6 py-3">내용</th>
                <th className="px-6 py-3">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {stats.recentLogs.length > 0 ? (
                stats.recentLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {format(new Date(log.sent_at), 'HH:mm:ss')}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-xs border border-blue-500/20">
                        {log.type || '알림'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-300">{log.recipient_name || log.recipient}</td>
                    <td className="px-6 py-4 text-slate-400 max-w-xs truncate">{log.content}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs border ${log.status === 'FAILED'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}>
                        {log.status === 'FAILED' ? '실패' : '성공'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
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

function StatsCard({ title, value, icon, sub }: { title: string, value: string | number, icon: string, sub?: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl hover:bg-slate-800/70 transition-all group backdrop-blur-sm">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-slate-400 text-sm font-medium">{title}</h3>
        <span className="text-2xl opacity-50 group-hover:opacity-100 transition-opacity transform group-hover:scale-110">{icon}</span>
      </div>
      <div className="flex items-end gap-2">
        <div className="text-4xl font-bold text-white tracking-tight">{value}</div>
        {sub && <div className="text-xs text-slate-500 mb-1.5 font-medium">{sub}</div>}
      </div>
    </div>
  );
}
