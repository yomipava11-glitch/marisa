
// Native relative time formatter — no external library needed
function timeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffSec = Math.round((now - then) / 1000);
    const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
    if (diffSec < 60) return rtf.format(-diffSec, 'second');
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return rtf.format(-diffMin, 'minute');
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return rtf.format(-diffH, 'hour');
    const diffD = Math.round(diffH / 24);
    return rtf.format(-diffD, 'day');
}



interface Log {
    id: string;
    type: 'fait' | 'probleme' | 'prevu';
    contenu: string;
    cree_le: string;
    profils: {
        nom: string;
        avatar_url: string;
    };
}

interface LogSectionProps {
    logs: Log[];
}

export function LogSection({ logs }: LogSectionProps) {
    const getBadgeStyle = (type: string) => {
        switch (type) {
            case 'probleme':
                return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'fait':
                return 'bg-[#00a651]/20 text-[#34d399] border-[#00a651]/30';
            case 'prevu':
                return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
        }
    };

    const getBadgeLabel = (type: string) => {
        switch (type) {
            case 'probleme': return 'Problème';
            case 'fait': return 'Fait';
            case 'prevu': return 'Prévu';
            default: return type;
        }
    };

    if (!logs || logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center text-white/50 bg-white/5 backdrop-blur-md rounded-2xl border border-white/5">
                <svg className="w-12 h-12 mb-3 opacity-50 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <p>Aucun journal pour le moment.</p>
                <p className="text-sm mt-1">Commencez à documenter l'avancement !</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-4">
            {logs.map(log => (
                <div key={log.id} className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/5 shadow-lg flex gap-4 transition-all hover:bg-white/10">
                    <img
                        src={log.profils?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + log.profils?.nom}
                        alt="avatar"
                        className="w-10 h-10 rounded-full border border-white/10 object-cover shrink-0 bg-[#191022]"
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                            <span className="font-semibold text-white/90 text-sm truncate">
                                {log.profils?.nom || 'Utilisateur inconnu'}
                            </span>
                            <span className="text-xs text-white/40 flex items-center gap-1 shrink-0">
                                <span className="material-symbols-rounded !text-[14px]">schedule</span>
                                {timeAgo(log.cree_le)}
                            </span>
                        </div>
                        <div className="mb-2">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${getBadgeStyle(log.type)}`}>
                                {getBadgeLabel(log.type)}
                            </span>
                        </div>
                        <p className="text-white/70 text-sm leading-relaxed break-words">
                            {log.contenu}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}
