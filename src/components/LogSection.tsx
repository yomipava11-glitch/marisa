import { DotLottieReact } from '@lottiefiles/dotlottie-react';

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
    utilisateur_id: string;
    profils: {
        nom: string;
        avatar_url: string;
    };
}

interface LogSectionProps {
    logs: Log[];
    currentUserId: string;
}

export function LogSection({ logs, currentUserId }: LogSectionProps) {
    const getBadgeStyle = (type: string, isMe: boolean) => {
        if (isMe) {
            switch (type) {
                case 'probleme': return 'bg-white/20 text-red-200 border-white/30';
                case 'fait': return 'bg-white/20 text-white border-white/30';
                case 'prevu': return 'bg-white/20 text-blue-200 border-white/30';
                default: return 'bg-white/20 text-white border-white/30';
            }
        }
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
            <div className="flex flex-col items-center justify-center py-8">
                <div style={{ width: '100%', maxWidth: '280px', aspectRatio: '1/1', opacity: 0.9, marginBottom: '1.5rem' }}>
                    <DotLottieReact
                        src="https://lottie.host/99b0d1dd-e64d-4435-bdf6-70efcd7062cb/SHipTflN9r.lottie"
                        loop
                        autoplay
                    />
                </div>
                <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', textAlign: 'center' }}>
                    Aucun message dans le journal
                </h4>
                <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center', maxWidth: '300px' }}>
                    Écrivez ou dictez votre premier log pour documenter l'avancement de la tâche.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-4 px-2 flex flex-col-reverse">
            {/* The flex-col-reverse makes the visual order reversed, so new messages are at the bottom while DOM retains them at the top (which matches order by cree_le descending) */}
            {logs.map(log => {
                const isMe = log.utilisateur_id === currentUserId;

                return (
                    <div key={log.id} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[85%] gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'} items-end`}>
                            <img
                                src={log.profils?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + log.profils?.nom}
                                alt="avatar"
                                className="w-8 h-8 rounded-full border border-white/10 object-cover shrink-0 bg-[#191022]"
                            />
                            
                            <div className={`relative px-4 py-2.5 rounded-2xl shadow-md ${
                                isMe 
                                ? 'bg-[#00a651] text-white rounded-br-sm' 
                                : 'bg-[#1e1b4b] border border-[#00a651]/30 text-white rounded-bl-sm'
                            }`}>
                                <div className="flex justify-between items-baseline mb-1 gap-4">
                                    {!isMe && <span className="text-xs font-bold opacity-80">{log.profils?.nom || 'Utilisateur inconnu'}</span>}
                                    <span className="text-[10px] opacity-60 ml-auto whitespace-nowrap">
                                        {timeAgo(log.cree_le)}
                                    </span>
                                </div>
                                <div className="mb-1">
                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${getBadgeStyle(log.type, isMe)}`}>
                                        {getBadgeLabel(log.type)}
                                    </span>
                                </div>
                                <p className={`text-sm leading-snug break-words ${isMe ? 'text-white/95' : 'text-white/80'}`}>
                                    {log.contenu}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
