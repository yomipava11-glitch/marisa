import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import './CollectiveTasks.css';

export function CollectiveTasks({ user, onNavigate }: { user: any, onNavigate: (page: string, data?: any) => void }) {
    const [tasks, setTasks] = useState<any[]>([]);
    const [feed, setFeed] = useState<any[]>([]);
    const allowedTaskIdsRef = useRef<string[]>([]);
    const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchCollectiveTasks();
        fetchActivityFeed();
        fetchPendingInvitesCount();

        // Subscribe to realtime feed updates
        const channel = supabase.channel('public:flux_activite')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'flux_activite' }, payload => {
                const newEntry = payload.new as any;
                if (allowedTaskIdsRef.current.includes(newEntry.tache_id) && newEntry.action === 'a_cree_tache_collective') {
                    setFeed(prev => [newEntry, ...prev]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel).catch(() => { });
        };
    }, []);

    const fetchPendingInvitesCount = async () => {
        const { count } = await supabase
            .from('membres_tache')
            .select('*', { count: 'exact', head: true })
            .eq('utilisateur_id', user.id)
            .eq('statut', 'en_attente');

        setPendingInvitesCount(count || 0);
    };

    const fetchCollectiveTasks = async () => {
        // Fetch tasks where user is a member or creator, AND est_collectif = true
        const { data: memberTasks } = await supabase
            .from('membres_tache')
            .select('tache_id')
            .eq('utilisateur_id', user.id)
            .eq('statut', 'accepte');

        const taskIds = memberTasks ? memberTasks.map(m => m.tache_id) : [];

        const orClause = taskIds.length > 0
            ? `createur_id.eq.${user.id},id.in.(${taskIds.join(',')})`
            : `createur_id.eq.${user.id}`;

        const { data } = await supabase
            .from('taches')
            .select('*, est_important, membres_tache(utilisateur_id, role), sous_taches(id, statut)')
            .eq('est_collectif', true)
            .neq('statut', 'supprimee')
            .or(orClause);

        if (data) setTasks(data);
        setLoading(false);
    };

    const fetchActivityFeed = async () => {
        // 1. Get task IDs where user is an accepted member
        const { data: memberTasks } = await supabase
            .from('membres_tache')
            .select('tache_id')
            .eq('utilisateur_id', user.id)
            .eq('statut', 'accepte');

        // 2. Get task IDs where user is the creator
        const { data: createdTasks } = await supabase
            .from('taches')
            .select('id')
            .eq('createur_id', user.id)
            .eq('est_collectif', true);

        // 3. Merge unique task IDs
        const taskIds = [
            ...(memberTasks?.map(m => m.tache_id) || []),
            ...(createdTasks?.map(t => t.id) || [])
        ].filter((v, i, a) => a.indexOf(v) === i);

        // Store for realtime filtering
        allowedTaskIdsRef.current = taskIds;

        if (taskIds.length === 0) {
            setFeed([]);
            setLoading(false);
            return;
        }

        const { data } = await supabase
            .from('flux_activite')
            .select('*, profils(nom, avatar_url), taches(titre)')
            .in('tache_id', taskIds)
            .eq('action', 'a_cree_tache_collective')
            .order('cree_le', { ascending: false })
            .limit(10);

        if (data) setFeed(data);
        setLoading(false);
    };

    const getTimeStatus = (start: string, end: string) => {
        if (!start || !end) return { percent: 0, state: 'normal' };
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        const nowTime = Date.now();

        if (nowTime <= startTime) return { percent: 0, state: 'normal' };

        let percent = Math.round(((nowTime - startTime) / (endTime - startTime)) * 100);

        if (percent >= 100) return { percent: 100, state: 'overdue' };
        if (percent >= 80) return { percent, state: 'urgent' };
        return { percent, state: 'normal' };
    };

    return (
        <div className="collective-container">
            {/* Header */}
            <header className="collective-header">
                <button className="icon-button" onClick={() => onNavigate('back')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="collective-title">Collective Tasks</h1>
                <button className="icon-button" style={{ position: 'relative' }} onClick={() => onNavigate('invitations')}>
                    <span className="material-symbols-outlined">mail</span>
                    {pendingInvitesCount > 0 && (
                        <span style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '0.75rem',
                            height: '0.75rem',
                            backgroundColor: '#ef4444',
                            borderRadius: '50%',
                            border: '2px solid var(--color-background-dark)'
                        }}></span>
                    )}
                </button>
            </header>

            <main className="main-content">
                {/* Filters */}
                <div className="filter-section">
                    <button className="filter-pill active">
                        <span>My Groups</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>expand_more</span>
                    </button>
                    <button className="filter-pill inactive">
                        <span>All Tasks</span>
                    </button>
                </div>

                {/* Social Feed */}
                <section>
                    <div className="section-header">
                        <h2 className="section-title">Social Activity Feed</h2>
                        <span className="section-badge">Live Now</span>
                    </div>
                    <div className="feed-list">
                        {feed.length === 0 && !loading && (
                            <p style={{ opacity: 0.5, fontSize: '0.875rem' }}>No recent activity.</p>
                        )}
                        {feed.map((act, i) => (
                            <div key={act.id} className={`feed-item ${i === 0 ? 'highlight' : ''}`}>
                                <img src={act.profils?.avatar_url || "https://ui-avatars.com/api/?name=" + (act.profils?.nom || 'User')} alt="Avatar" className="feed-avatar" />
                                <div className="feed-content">
                                    <div className="feed-header">
                                        <p className="feed-text"><span className="feed-user">{act.profils?.nom || 'Anonymous'}</span> a créé tâche collective</p>
                                        <span className="feed-time">
                                            {new Date(act.cree_le).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="feed-subtext">{act.taches?.titre || 'A task'}</p>
                                    <div className="feed-action">
                                        <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', color: '#4ade80' }}>check_circle</span>
                                        <span style={{ fontSize: '0.625rem', color: '#cbd5e1' }}>Verified</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Active Group Tasks */}
                <section>
                    <div className="section-header">
                        <h2 className="section-title">Active Group Tasks</h2>
                    </div>
                    <div className="tasks-grid">
                        {tasks.length === 0 && !loading && (
                            <p style={{ opacity: 0.5, fontSize: '0.875rem' }}>No collective tasks found.</p>
                        )}
                        {tasks.map(task => {
                            const timeStatus = (task.date_debut && task.date_echeance) ? getTimeStatus(task.date_debut, task.date_echeance) : { percent: 0, state: 'normal' };
                            const isCompleted = task.statut === 'terminee';
                            const totalSub = task.sous_taches?.length || 0;
                            const doneSub = task.sous_taches?.filter((s: any) => s.statut === 'terminee').length || 0;
                            const subProgress = totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : 0;

                            return (
                                <div
                                    key={task.id}
                                    className={`group-task-card ${isCompleted ? 'completed' : ''}`}
                                    onClick={() => onNavigate('taskDetails', task)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="task-card-header">
                                        <div className="task-icon-box">
                                            {task.icone_url ? (
                                                <img src={task.icone_url} alt="Task Icon" style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />
                                            ) : (
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.875rem' }}>auto_awesome</span>
                                            )}
                                        </div>
                                        <div className="avatars-stack">
                                            <img src={user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=User"} className="stack-avatar" alt="User" />
                                            {task.membres_tache?.slice(0, 2).map((_: any, i: number) => (
                                                <div key={i} className="stack-avatar" style={{ backgroundColor: '#475569' }}></div>
                                            ))}
                                            {task.membres_tache?.length > 2 && (
                                                <div className="stack-more">+{task.membres_tache.length - 2}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <h3 className="task-card-title" style={{ textDecoration: isCompleted ? 'line-through' : 'none', opacity: isCompleted ? 0.7 : 1 }}>
                                                {task.titre}
                                            </h3>
                                            {!isCompleted && timeStatus.state === 'overdue' && (
                                                <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Retard</span>
                                            )}
                                            {!isCompleted && timeStatus.state === 'urgent' && (
                                                <span style={{ fontSize: '0.625rem', padding: '0.125rem 0.5rem', borderRadius: '9999px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>Urgente</span>
                                            )}
                                        </div>
                                        <p className="task-card-desc">{task.description}</p>
                                    </div>

                                    {/* Sous-tâches progress bar */}
                                    {totalSub > 0 && (
                                        <div style={{ marginTop: '0.75rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Progression</span>
                                                <span style={{ fontSize: '0.65rem', color: subProgress === 100 ? '#4ade80' : 'rgba(255,255,255,0.6)', fontWeight: 700 }}>
                                                    {doneSub}/{totalSub} sous-tâches
                                                </span>
                                            </div>
                                            <div className="progress-bar-bg">
                                                <div
                                                    className="progress-bar-fill"
                                                    style={{
                                                        width: `${subProgress}%`,
                                                        background: subProgress === 100 ? '#4ade80' : timeStatus.state === 'overdue' ? '#ef4444' : timeStatus.state === 'urgent' ? '#f59e0b' : 'var(--color-primary)',
                                                        transition: 'width 0.6s ease'
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>

            {/* FAB - overrides default positioning slightly for this view */}
            <div style={{ position: 'fixed', bottom: '7rem', right: '1.5rem', zIndex: 30 }}>
                <button className="fab-button" style={{ position: 'relative', bottom: 0, right: 0 }} onClick={() => onNavigate('create')}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>add</span>
                </button>
            </div>

            {/* Bottom Nav */}
            <div className="bottom-nav-container">
                <div className="bottom-nav">
                    <button className="nav-item" onClick={() => onNavigate('dashboard')}>
                        <span className="material-symbols-outlined">bar_chart</span>
                        <span className="nav-label">Stats</span>
                    </button>
                    <button className="nav-item active">
                        <span className="material-symbols-outlined">group</span>
                        <span className="nav-label">Collective</span>
                    </button>
                    <button className="nav-item" onClick={() => onNavigate('ai-assistant')}>
                        <span className="material-symbols-outlined">robot_2</span>
                        <span className="nav-label">Scrum</span>
                    </button>
                    <button className="nav-item" onClick={() => onNavigate('profile')}>
                        <span className="material-symbols-outlined">account_circle</span>
                        <span className="nav-label">Profile</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
