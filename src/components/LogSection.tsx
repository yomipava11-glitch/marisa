import React from 'react';
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
    const getBadgeStyle = (type: string, isMe: boolean): React.CSSProperties => {
        if (isMe) {
            switch (type) {
                case 'probleme': return { background: 'rgba(255,255,255,0.2)', color: '#fca5a5', border: '1px solid rgba(255,255,255,0.3)' };
                case 'fait': return { background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' };
                case 'prevu': return { background: 'rgba(255,255,255,0.2)', color: '#93c5fd', border: '1px solid rgba(255,255,255,0.3)' };
                default: return { background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)' };
            }
        }
        switch (type) {
            case 'probleme':
                return { background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' };
            case 'fait':
                return { background: 'rgba(0,166,81,0.2)', color: '#34d399', border: '1px solid rgba(0,166,81,0.3)' };
            case 'prevu':
                return { background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' };
            default:
                return { background: 'rgba(107,114,128,0.2)', color: '#9ca3af', border: '1px solid rgba(107,114,128,0.3)' };
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
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 0' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '1rem', paddingBottom: '1rem', padding: '0 0.5rem 1rem 0.5rem' }}>
            {logs.map(log => {
                const isMe = log.utilisateur_id === currentUserId;

                return (
                    <div key={log.id} style={{ display: 'flex', width: '100%', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{ display: 'flex', maxWidth: '85%', gap: '0.5rem', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                            <img
                                src={log.profils?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + log.profils?.nom}
                                alt="avatar"
                                style={{
                                    width: '2rem', height: '2rem', borderRadius: '50%',
                                    border: '1px solid rgba(255,255,255,0.1)', objectFit: 'cover',
                                    flexShrink: 0, background: '#191022'
                                }}
                            />

                            <div style={{
                                position: 'relative',
                                padding: '0.625rem 1rem',
                                borderRadius: isMe ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.3)',
                                ...(isMe
                                    ? { background: '#00a651', color: '#fff' }
                                    : { background: '#1e1b4b', border: '1px solid rgba(0,166,81,0.3)', color: '#fff' }
                                )
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.25rem', gap: '1rem' }}>
                                    {!isMe && <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8 }}>{log.profils?.nom || 'Utilisateur inconnu'}</span>}
                                    <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                        {timeAgo(log.cree_le)}
                                    </span>
                                </div>
                                <div style={{ marginBottom: '0.25rem' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        padding: '0.125rem 0.375rem',
                                        borderRadius: '0.25rem',
                                        fontSize: '9px',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        ...getBadgeStyle(log.type, isMe)
                                    }}>
                                        {getBadgeLabel(log.type)}
                                    </span>
                                </div>
                                <p style={{
                                    fontSize: '0.875rem',
                                    lineHeight: 1.4,
                                    wordBreak: 'break-word',
                                    margin: 0,
                                    color: isMe ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.8)'
                                }}>
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
