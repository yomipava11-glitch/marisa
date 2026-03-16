import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './Notifications.css';

interface NotificationItem {
    id: string;
    tache_id: string;
    utilisateur_id: string;
    action: string;
    details: any;
    cree_le: string;
    utilisateur?: { nom?: string; avatar_url?: string };
    tache?: { titre?: string; est_collectif?: boolean };
}

export function Notifications({ user, onNavigate }: { user: any, onNavigate: (page: string, data?: any) => void }) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchNotifications();

        // Subscribe to new activity
        const channel = supabase.channel('public:flux_activite')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flux_activite' }, () => {
                fetchNotifications();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel).catch(() => { });
        };
    }, []);

    const fetchNotifications = async () => {
        try {
            // Fetch activities. To get relevant activities, we can fetch all for now or filter by user tasks.
            // A comprehensive approach is fetching recent activities mapped to tasks where the user is involved.

            // First, get tasks where user is involved (creator or member)
            const { data: myTasksRes } = await supabase
                .from('taches')
                .select('id, createur_id');
            const { data: myMemberships } = await supabase
                .from('membres_tache')
                .select('tache_id')
                .eq('utilisateur_id', user.id);

            const myTaskIds = new Set<string>();
            if (myTasksRes) {
                myTasksRes.filter((t: any) => t.createur_id === user.id).forEach((t: any) => myTaskIds.add(t.id));
            }
            if (myMemberships) {
                myMemberships.forEach((m: any) => myTaskIds.add(m.tache_id));
            }

            if (myTaskIds.size === 0) {
                setNotifications([]);
                setLoading(false);
                return;
            }

            // Fetch activity for these tasks
            const { data, error } = await supabase
                .from('flux_activite')
                .select(`
                    id,
                    tache_id,
                    utilisateur_id,
                    action,
                    details,
                    cree_le,
                    utilisateur:profils(nom, avatar_url),
                    tache:taches(titre, est_collectif)
                `)
                .in('tache_id', Array.from(myTaskIds))
                .order('cree_le', { ascending: false })
                .limit(50);

            if (error) {
                console.error("Error fetching notifications", error);
                return;
            }

            // Only show actions that aren't exclusively "user created task" if they are the current user, to reduce noise.
            // But for now, we'll format them nicely.
            setNotifications(data as unknown as NotificationItem[]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const getRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (diffInSeconds < 60) return `Il y a ${diffInSeconds} s`;
        if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
        if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
        return `Il y a ${Math.floor(diffInSeconds / 86400)} j`;
    };

    const formatNotificationText = (notif: NotificationItem) => {
        const userName = notif.utilisateur?.nom || 'Un utilisateur';
        const taskName = notif.tache?.titre || 'une tâche';

        if (notif.action === 'Terminer') {
            return <span><strong>{userName}</strong> a terminé la tâche <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Sous-tâche terminée') {
            const subtaskName = notif.details?.titre_sous_tache || 'une sous-tâche';
            return <span><strong>{userName}</strong> a terminé la sous-tâche <em>{subtaskName}</em> dans <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Création') {
            return <span><strong>{userName}</strong> a créé la tâche <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Rejoindre') {
            return <span><strong>{userName}</strong> a rejoint la tâche <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Suppression') {
            return <span><strong>{userName}</strong> a supprimé la tâche <em>{taskName}</em>.</span>;
        } else {
            return <span><strong>{userName}</strong> a effectué l'action "{notif.action}" sur <em>{taskName}</em>.</span>;
        }
    };

    const getIcon = (action: string) => {
        switch (action) {
            case 'Terminer': return 'task_alt';
            case 'Sous-tâche terminée': return 'check_circle';
            case 'Création': return 'add_task';
            case 'Rejoindre': return 'group_add';
            case 'Suppression': return 'delete';
            default: return 'notifications';
        }
    };

    const getIconColor = (action: string) => {
        switch (action) {
            case 'Terminer': return 'var(--color-success)';
            case 'Sous-tâche terminée': return '#b744ff';
            case 'Création': return 'var(--color-primary)';
            case 'Rejoindre': return 'var(--color-warning)';
            case 'Suppression': return '#ef4444';
            default: return 'var(--color-text)';
        }
    };

    return (
        <div className="notifications-container">
            {/* Ambient Background Orbs */}
            <div className="notif-orb notif-orb-1"></div>
            <div className="notif-orb notif-orb-2"></div>

            <div className="notif-header">
                <button className="notif-back-btn" onClick={() => onNavigate('back')}>
                    <span className="material-symbols-outlined">arrow_back_ios_new</span>
                </button>
                <h1 className="notif-title">Notifications</h1>
                <div style={{ width: 40 }}></div> {/* Spacer for centering */}
            </div>

            <div className="notif-list-wrapper">
                {loading ? (
                    <div className="notif-loading">
                        <span className="material-symbols-outlined spin-fast">sync</span>
                        <p>Chargement des notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="notif-empty">
                        <span className="material-symbols-outlined empty-icon">notifications_off</span>
                        <p>Aucune notification pour le moment.</p>
                        <p className="notif-empty-sub">Vous serez alerté ici de l'activité sur vos tâches.</p>
                    </div>
                ) : (
                    <div className="notif-list">
                        {notifications.map((notif, index) => (
                            <div className="notif-card" key={notif.id} style={{ animationDelay: `${index * 0.05}s` }}>
                                <div className="notif-avatar-container">
                                    {notif.utilisateur?.avatar_url ? (
                                        <img src={notif.utilisateur.avatar_url} alt="Avatar" className="notif-avatar" />
                                    ) : (
                                        <div className="notif-initial" style={{ backgroundColor: getIconColor(notif.action) }}>
                                            <span className="material-symbols-outlined">{getIcon(notif.action)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="notif-content">
                                    <p className="notif-text">{formatNotificationText(notif)}</p>
                                    <div className="notif-meta">
                                        <span className="material-symbols-outlined time-icon">schedule</span>
                                        <span className="notif-time">{getRelativeTime(notif.cree_le)}</span>
                                        {notif.tache?.est_collectif && (
                                            <span className="notif-badge group-badge">Collectif</span>
                                        )}
                                    </div>
                                </div>

                                {/* Unread indicator dot - currently showing for all recent out of simplicity, but can be tied to local storage */}
                                {index < 3 && <div className="notif-unread-dot"></div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
