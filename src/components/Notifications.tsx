import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cacheSet, cacheGet, isOnline } from '../lib/offlineCache';
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
    isAlerte?: boolean; // for dynamically generated deadline alerts
}

export function Notifications({ user, onNavigate }: { user: any, onNavigate: (page: string, data?: any) => void }) {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [deadlineAlerts, setDeadlineAlerts] = useState<NotificationItem[]>([]);

    useEffect(() => {
        // Load from cache first
        const cached = cacheGet<NotificationItem[]>(`notifications_${user.id}`);
        if (cached) { setNotifications(cached); setLoading(false); }

        if (isOnline()) {
            fetchNotifications();
            fetchDeadlineAlerts();
        } else {
            setLoading(false);
        }

        // Subscribe to new activity
        const channel = supabase.channel('public:flux_activite')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flux_activite' }, () => {
                fetchNotifications();
            })
            .subscribe();

        const goOnline = () => { fetchNotifications(); fetchDeadlineAlerts(); };
        window.addEventListener('online', goOnline);

        return () => {
            window.removeEventListener('online', goOnline);
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
            setNotifications(data as unknown as NotificationItem[]);
            cacheSet(`notifications_${user.id}`, data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Generate deadline alerts dynamically from task dates
    const fetchDeadlineAlerts = async () => {
        try {
            // Fetch all non-completed tasks where user is creator or member
            const { data: myTasksRes } = await supabase
                .from('taches')
                .select('id, titre, date_echeance, createur_id')
                .neq('statut', 'terminee')
                .neq('statut', 'supprimee')
                .not('date_echeance', 'is', null);

            const { data: myMemberships } = await supabase
                .from('membres_tache')
                .select('tache_id')
                .eq('utilisateur_id', user.id);

            const memberTaskIds = new Set(myMemberships?.map(m => m.tache_id) || []);

            const relevantTasks = (myTasksRes || []).filter((t: any) =>
                t.createur_id === user.id || memberTaskIds.has(t.id)
            );

            const now = Date.now();
            const in24h = now + 24 * 60 * 60 * 1000;
            const alerts: NotificationItem[] = [];

            for (const t of relevantTasks) {
                const echeance = new Date(t.date_echeance).getTime();

                if (echeance < now) {
                    // Overdue
                    alerts.push({
                        id: `alert_overdue_${t.id}`,
                        tache_id: t.id,
                        utilisateur_id: user.id,
                        action: 'Retard',
                        details: {},
                        cree_le: t.date_echeance,
                        tache: { titre: t.titre },
                        isAlerte: true,
                    });
                } else if (echeance < in24h) {
                    // Warning: due within 24h
                    alerts.push({
                        id: `alert_warn_${t.id}`,
                        tache_id: t.id,
                        utilisateur_id: user.id,
                        action: 'Avertissement',
                        details: {},
                        cree_le: t.date_echeance,
                        tache: { titre: t.titre },
                        isAlerte: true,
                    });
                }
            }

            setDeadlineAlerts(alerts);
        } catch (err) {
            console.error('Error fetching deadline alerts:', err);
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

        if (notif.action === 'Retard') {
            return <span>⚠️ La tâche <em>{taskName}</em> est <strong>en retard</strong> !</span>;
        } else if (notif.action === 'Avertissement') {
            return <span>⏳ La tâche <em>{taskName}</em> arrive à échéance dans <strong>moins de 24h</strong>.</span>;
        } else if (notif.action === 'Terminer') {
            return <span><strong>{userName}</strong> a terminé la tâche <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Sous-tâche terminée') {
            const subtaskName = notif.details?.titre_sous_tache || 'une sous-tâche';
            return <span><strong>{userName}</strong> a terminé la sous-tâche <em>{subtaskName}</em> dans <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Création') {
            return <span><strong>{userName}</strong> a créé la tâche <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Rejoindre') {
            return <span><strong>{userName}</strong> a rejoint la tâche <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Nouveau log') {
            const logType = notif.details?.type_log || '';
            return <span>📝 <strong>{userName}</strong> a ajouté un log{logType ? ` (${logType})` : ''} dans <em>{taskName}</em>.</span>;
        } else if (notif.action === 'Membre ajouté') {
            const memberName = notif.details?.membre_nom || 'un membre';
            return <span>👥 <strong>{memberName}</strong> a été ajouté(e) à <em>{taskName}</em>.</span>;
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
            case 'Retard': return 'warning';
            case 'Avertissement': return 'schedule';
            case 'Nouveau log': return 'edit_note';
            case 'Membre ajouté': return 'person_add';
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
            case 'Retard': return '#ef4444';
            case 'Avertissement': return '#f59e0b';
            case 'Nouveau log': return '#60a5fa';
            case 'Membre ajouté': return '#a855f7';
            default: return 'var(--color-text)';
        }
    };

    // Merge deadline alerts at the top, then activity notifications
    const allNotifications = [...deadlineAlerts, ...notifications];

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
                ) : allNotifications.length === 0 ? (
                    <div className="notif-empty">
                        <span className="material-symbols-outlined empty-icon">notifications_off</span>
                        <p>Aucune notification pour le moment.</p>
                        <p className="notif-empty-sub">Vous serez alerté ici de l'activité sur vos tâches.</p>
                    </div>
                ) : (
                    <div className="notif-list">
                        {allNotifications.map((notif, index) => (
                            <div className={`notif-card ${notif.isAlerte ? 'notif-alerte' : ''}`} key={notif.id} style={{ animationDelay: `${index * 0.05}s` }}>
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
