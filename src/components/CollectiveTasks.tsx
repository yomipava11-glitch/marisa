import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { cacheSet, cacheGet, isOnline, formatCacheAge } from '../lib/offlineCache';
import './CollectiveTasks.css';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export function CollectiveTasks({ user, onNavigate }: { user: any, onNavigate: (page: string, data?: any) => void }) {
    const [tasks, setTasks] = useState<any[]>([]);
    const [feed, setFeed] = useState<any[]>([]);
    const allowedTaskIdsRef = useRef<string[]>([]);
    const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFeedIndex, setActiveFeedIndex] = useState(0);
    const [seenTasks, setSeenTasks] = useState<Set<string>>(new Set());
    const [offline, setOffline] = useState(!navigator.onLine);
    const [cacheAge, setCacheAge] = useState<string | null>(null);

    useEffect(() => {
        // Load cached data immediately
        const cachedTasks = cacheGet<any[]>(`collective_tasks_${user.id}`);
        if (cachedTasks) { setTasks(cachedTasks); setLoading(false); }
        const cachedFeed = cacheGet<any[]>(`collective_feed_${user.id}`);
        if (cachedFeed) setFeed(cachedFeed);

        if (isOnline()) {
            fetchCollectiveTasks();
            fetchActivityFeed();
            fetchPendingInvitesCount();
        } else {
            setLoading(false);
            setCacheAge(formatCacheAge(`collective_tasks_${user.id}`));
        }

        const goOnline = () => { setOffline(false); fetchCollectiveTasks(); fetchActivityFeed(); fetchPendingInvitesCount(); };
        const goOffline = () => { setOffline(true); setCacheAge(formatCacheAge(`collective_tasks_${user.id}`)); };
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

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
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
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
            .select('*, est_important, membres_tache(utilisateur_id, role, statut, vu, profils(nom, avatar_url)), sous_taches(id, statut)')
            .eq('est_collectif', true)
            .neq('statut', 'supprimee')
            .or(orClause);

        if (data) {
            setTasks(data);
            cacheSet(`collective_tasks_${user.id}`, data);
        }
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

        if (data) {
            setFeed(data);
            cacheSet(`collective_feed_${user.id}`, data);
        }
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

    const handleFeedScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const container = e.currentTarget;
        const scrollLeft = container.scrollLeft;
        
        const itemWidth = container.children[0]?.clientWidth || 0;
        const gap = 16; // 1rem
        
        if (itemWidth > 0) {
            const index = Math.round(scrollLeft / (itemWidth + gap));
            setActiveFeedIndex(Math.min(feed.length - 1, Math.max(0, index)));
        }
    };

    return (
        <div className="collective-container">
            {offline && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
                    background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                    color: '#000', textAlign: 'center',
                    padding: '0.4rem 1rem', fontSize: '0.75rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>wifi_off</span>
                    Mode hors-ligne {cacheAge ? `• Données ${cacheAge}` : ''}
                </div>
            )}
            {/* Header */}
            <header className="collective-header">
                <button className="icon-button" onClick={() => onNavigate('back')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="collective-title">Tâches Collectives</h1>
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
                        <span>Mes Groupes</span>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>expand_more</span>
                    </button>
                    <button className="filter-pill inactive">
                        <span>Toutes les Tâches</span>
                    </button>
                </div>

                {/* Social Feed */}
                <section>
                    <div className="section-header">
                        <h2 className="section-title">Fil d'Activité</h2>
                        <span className="section-badge">En Direct</span>
                    </div>
                    {feed.length === 0 && !loading ? (
                        <p style={{ opacity: 0.5, fontSize: '0.875rem', padding: '0 0.5rem' }}>Aucune activité récente.</p>
                    ) : feed.length > 0 && (
                        <div className="snap-carousel-container">
                            <div className="snap-carousel-track" onScroll={handleFeedScroll}>
                                {feed.map((act, i) => (
                                    <div key={act.id} className={`feed-item snap-carousel-item ${i === 0 ? 'highlight' : ''}`}>
                                        <img src={act.profils?.avatar_url || "https://ui-avatars.com/api/?name=" + (act.profils?.nom || 'Utilisateur')} alt="Avatar" className="feed-avatar" />
                                        <div className="feed-content">
                                            <div className="feed-header">
                                                <p className="feed-text"><span className="feed-user">{act.profils?.nom || 'Anonyme'}</span> a créé une tâche collective</p>
                                                <span className="feed-time">
                                                    {new Date(act.cree_le).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="feed-subtext">{act.taches?.titre || 'Une tâche'}</p>
                                            <div className="feed-action">
                                                <span className="material-symbols-outlined" style={{ fontSize: '0.875rem', color: '#4ade80' }}>check_circle</span>
                                                <span style={{ fontSize: '0.625rem', color: '#cbd5e1' }}>Vérifié</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {feed.length > 1 && (
                                <div className="snap-carousel-dots">
                                    {feed.map((_, i) => (
                                        <button 
                                            key={i} 
                                            className={`snap-dot ${i === activeFeedIndex ? 'active' : ''}`}
                                            aria-label={`Slide ${i + 1}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>

                {/* Active Group Tasks */}
                <section>
                    <div className="section-header">
                        <h2 className="section-title">Tâches de Groupe Actives</h2>
                        <button className="icon-button" onClick={() => setIsSearchOpen(!isSearchOpen)} style={{ background: isSearchOpen ? 'rgba(0, 166, 81, 0.2)' : 'transparent', color: isSearchOpen ? '#34d399' : '#f8fafc', transition: 'all 0.3s' }}>
                            <span className="material-symbols-outlined">search</span>
                        </button>
                    </div>

                    {/* Search Bar Ploub Animation */}
                    <div className={`search-bar-container ${isSearchOpen ? 'open' : ''}`}>
                        <div className="search-bar-inner">
                            <span className="material-symbols-outlined search-icon-inner">search</span>
                            <input 
                                type="text"
                                placeholder="Rechercher une tâche (titre, description)..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input"
                            />
                            {searchQuery && (
                                <button className="icon-button" style={{ transform: 'scale(0.8)', opacity: 0.7 }} onClick={() => setSearchQuery('')}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="tasks-grid">
                        {tasks.length === 0 && !loading && (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', width: '100%', minHeight: '50vh', gridColumn: '1 / -1' }}>
                                <div style={{ width: '100%', maxWidth: '350px', aspectRatio: '1/1', opacity: 0.9 }}>
                                    <DotLottieReact
                                        src="https://lottie.host/12af6790-384a-46ce-a23c-4e97c4d5ba79/sSJyw5g6gX.lottie"
                                        loop
                                        autoplay
                                    />
                                </div>
                                <h3 style={{ margin: '1rem 0 0', fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', textAlign: 'center' }}>
                                    Aucune tâche collective
                                </h3>
                                <button 
                                    onClick={() => onNavigate('create')}
                                    style={{
                                        marginTop: '2rem',
                                        background: 'var(--color-primary)',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.75rem 1.75rem',
                                        borderRadius: '99px',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        boxShadow: '0 4px 15px rgba(0, 166, 81, 0.4)',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'scale(1.05) translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 166, 81, 0.6)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'scale(1) translateY(0)';
                                        e.currentTarget.style.boxShadow = '0 4px 15px rgba(0, 166, 81, 0.4)';
                                    }}
                                >
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                                    Nouvelle tâche
                                </button>
                            </div>
                        )}
                        {tasks.filter(t => t.titre?.toLowerCase().includes(searchQuery.toLowerCase()) || t.description?.toLowerCase().includes(searchQuery.toLowerCase())).map(task => {
                            const timeStatus = (task.date_debut && task.date_echeance) ? getTimeStatus(task.date_debut, task.date_echeance) : { percent: 0, state: 'normal' };
                            const isCompleted = task.statut === 'terminee';
                            const totalSub = task.sous_taches?.length || 0;
                            const doneSub = task.sous_taches?.filter((s: any) => s.statut === 'terminee').length || 0;
                            const subProgress = totalSub > 0 ? Math.round((doneSub / totalSub) * 100) : 0;

                            // Check if this task is "new" (unseen) for the current user
                            const memberEntry = task.membres_tache?.find((m: any) => m.utilisateur_id === user.id);
                            const isNewTask = memberEntry?.vu === false && !seenTasks.has(task.id);

                            const handleTaskClick = () => {
                                if (isNewTask) {
                                    // Fire-and-forget: mark as seen
                                    setSeenTasks(prev => new Set(prev).add(task.id));
                                    supabase
                                        .from('membres_tache')
                                        .update({ vu: true })
                                        .eq('tache_id', task.id)
                                        .eq('utilisateur_id', user.id)
                                        .then();
                                }
                                onNavigate('taskDetails', task);
                            };

                            return (
                                <div
                                    key={task.id}
                                    className={`group-task-card ${isCompleted ? 'completed' : ''} ${isNewTask ? 'new-task' : ''}`}
                                    onClick={handleTaskClick}
                                    style={{ cursor: 'pointer' }}
                                >
                                    {isNewTask && <span className="new-task-badge">Nouveau</span>}
                                    <div className="task-card-header">
                                        <div className="task-icon-box">
                                            {task.icone_url ? (
                                                task.icone_url.startsWith('http') ? (
                                                    <img src={task.icone_url} alt="Task Icon" style={{ width: '100%', height: '100%', borderRadius: 'inherit' }} />
                                                ) : (
                                                    <span className="material-symbols-outlined" style={{ fontSize: '1.875rem' }}>{task.icone_url}</span>
                                                )
                                            ) : (
                                                <span className="material-symbols-outlined" style={{ fontSize: '1.875rem' }}>auto_awesome</span>
                                            )}
                                        </div>
                                        <div className="avatars-stack">
                                            <img src={user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=" + (user.user_metadata?.full_name || 'U')} className="stack-avatar" alt="User" title="Moi" />
                                            {task.membres_tache?.filter((m:any) => m.utilisateur_id !== user.id).slice(0, 2).map((member: any, i: number) => {
                                                const nom = member.profils?.nom || 'Membre';
                                                const avatarUrl = member.profils?.avatar_url || "https://ui-avatars.com/api/?name=" + nom + "&color=fff&background=random";
                                                return (
                                                    <img key={i} src={avatarUrl} className="stack-avatar" alt={nom} title={nom} />
                                                );
                                            })}
                                            {task.membres_tache?.filter((m:any) => m.utilisateur_id !== user.id).length > 2 && (
                                                <div className="stack-more">+{task.membres_tache.filter((m:any) => m.utilisateur_id !== user.id).length - 2}</div>
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
                        <span className="nav-label">Collectif</span>
                    </button>
                    <button className="nav-item" onClick={() => onNavigate('ai-assistant')}>
                        <span className="material-symbols-outlined">robot_2</span>
                        <span className="nav-label">Scrum</span>
                    </button>
                    <button className="nav-item" onClick={() => onNavigate('profile')}>
                        <span className="material-symbols-outlined">account_circle</span>
                        <span className="nav-label">Profil</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
