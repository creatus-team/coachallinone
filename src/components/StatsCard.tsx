export default function StatsCard({ title, value, icon, sub }: { title: string, value: string | number, icon: string, sub?: string }) {
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
