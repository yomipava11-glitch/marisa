import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { cacheSet, cacheGet, isOnline, formatCacheAge } from '../lib/offlineCache';
import confetti from 'canvas-confetti';
import './Dashboard.css';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
export function Dashboard({ user, onSignOut, onNavigate }: { user: any, onSignOut: () => void, onNavigate: (page: string, data?: any) => void }) {
    const [advice, setAdvice] = useState<string>("Chargement de vos conseils productivité...");
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalXP, setTotalXP] = useState<number>(0);
    const [weeklyStats, setWeeklyStats] = useState<{ dayName: string, count: number, isToday: boolean }[]>([]);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [offline, setOffline] = useState(!navigator.onLine);
    const [cacheAge, setCacheAge] = useState<string | null>(null);

    useEffect(() => {
        if (!isDragging) return;

        let scrollSpeed = 0;
        let animationFrameId: number;

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const threshold = 85; 
            const maxSpeed = 15; 
            
            const container = scrollContainerRef.current;
            if (!container) return;

            const rect = container.getBoundingClientRect();
            
            if (rect.right - clientX < threshold && clientX < rect.right + 50) {
                const intensity = 1 - Math.max(0, rect.right - clientX) / threshold;
                scrollSpeed = maxSpeed * intensity;
            } else if (clientX - rect.left < threshold && clientX > rect.left - 50) {
                const intensity = 1 - Math.max(0, clientX - rect.left) / threshold;
                scrollSpeed = -maxSpeed * intensity;
            } else {
                scrollSpeed = 0;
            }
        };

        const performScroll = () => {
            if (scrollSpeed !== 0 && scrollContainerRef.current) {
                scrollContainerRef.current.scrollLeft += scrollSpeed;
            }
            animationFrameId = requestAnimationFrame(performScroll);
        };

        window.addEventListener('mousemove', handleMove, { capture: true });
        window.addEventListener('touchmove', handleMove, { passive: true, capture: true });
        animationFrameId = requestAnimationFrame(performScroll);

        return () => {
            window.removeEventListener('mousemove', handleMove, { capture: true });
            window.removeEventListener('touchmove', handleMove, { capture: true });
            cancelAnimationFrame(animationFrameId);
        };
    }, [isDragging]);

    useEffect(() => {
        // Load cached data immediately for instant display
        const cachedTasks = cacheGet<any[]>(`dashboard_tasks_${user.id}`);
        if (cachedTasks) {
            setTasks(cachedTasks);
            setLoading(false);
        }
        const cachedXP = cacheGet<number>(`dashboard_xp_${user.id}`);
        if (cachedXP !== null) setTotalXP(cachedXP);
        const cachedStats = cacheGet<any[]>(`dashboard_stats_${user.id}`);
        if (cachedStats) setWeeklyStats(cachedStats);

        // Then fetch fresh data if online
        if (isOnline()) {
            fetchAdvice();
            fetchTasks();
            fetchStats();
        } else {
            setLoading(false);
            setCacheAge(formatCacheAge(`dashboard_tasks_${user.id}`));
        }

        // Listen for online/offline events
        const goOnline = () => { setOffline(false); fetchTasks(); fetchStats(); };
        const goOffline = () => { setOffline(true); setCacheAge(formatCacheAge(`dashboard_tasks_${user.id}`)); };
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);

        // Realtime subscription for tasks
        const channel = supabase.channel('public:taches')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'taches', filter: `createur_id=eq.${user.id}` }, () => {
                fetchTasks();
            })
            .subscribe();

        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
            supabase.removeChannel(channel).catch(() => { });
        };
    }, []);

    const fetchStats = async () => {
        const { data } = await supabase
            .from('flux_activite')
            .select('cree_le')
            .eq('utilisateur_id', user.id)
            .eq('action', 'Terminer');

        if (data) {
            const xp = data.length * 10;
            setTotalXP(xp);
            cacheSet(`dashboard_xp_${user.id}`, xp); // 10 XP per task

            const stats = [];
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            
            for (let i = 6; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const dayStart = new Date(d);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(d);
                dayEnd.setHours(23, 59, 59, 999);

                const count = data.filter(a => {
                    const actionDate = new Date(a.cree_le);
                    return actionDate >= dayStart && actionDate <= dayEnd;
                }).length;

                stats.push({
                    dayName: d.toLocaleDateString('fr-FR', { weekday: 'short' }).substring(0, 3).replace('.', ''),
                    count,
                    isToday: i === 0
                });
            }
            setWeeklyStats(stats);
            cacheSet(`dashboard_stats_${user.id}`, stats);
        }
    };

    const fetchAdvice = async () => {
        try {
            const { data } = await supabase.functions.invoke('conseil-ia-quotidien');
            if (data && data.conseil) {
                setAdvice(data.conseil);
            }
        } catch (e) {
            console.error(e);
            setAdvice("Pensez à diviser vos tâches complexes en petites étapes !");
        }
    };

    const fetchTasks = async () => {
        const { data } = await supabase
            .from('taches')
            .select('*, est_important')
            .eq('createur_id', user.id)
            .eq('est_collectif', false)
            .neq('statut', 'supprimee')
            .order('cree_le', { ascending: false });

        if (data) {
            setTasks(data);
            cacheSet(`dashboard_tasks_${user.id}`, data);
        }
        setLoading(false);
    };

    const toggleTaskStatus = async (task: any) => {
        const newStatus = task.statut === 'terminee' ? 'en_cours' : 'terminee';
        
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, statut: newStatus } : t));

        await supabase.from('taches').update({ statut: newStatus }).eq('id', task.id);

        if (newStatus === 'terminee') {
            await supabase.from('flux_activite').insert({
                tache_id: task.id,
                utilisateur_id: user.id,
                action: 'Terminer',
                details: {}
            });
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#a855f7', '#00a651', '#3b82f6', '#f59e0b']
            });
        } else {
            await supabase.from('flux_activite')
                .delete()
                .eq('tache_id', task.id)
                .eq('utilisateur_id', user.id)
                .eq('action', 'Terminer');
        }

        fetchStats();
    };

    const onDragEnd = async (result: DropResult) => {
        if (!result.destination) return;
        const { source, destination, draggableId } = result;

        if (source.droppableId === destination.droppableId) return;

        const newStatus = destination.droppableId;
        const oldStatus = source.droppableId;

        // Optimistic update
        setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, statut: newStatus } : t));

        // DB update
        await supabase.from('taches').update({ statut: newStatus }).eq('id', draggableId);

        if (newStatus === 'terminee') {
            await supabase.from('flux_activite').insert({
                tache_id: draggableId,
                utilisateur_id: user.id,
                action: 'Terminer',
                details: {}
            });
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#a855f7', '#00a651', '#3b82f6', '#f59e0b']
            });
        } else if (oldStatus === 'terminee') {
            await supabase.from('flux_activite')
                .delete()
                .eq('tache_id', draggableId)
                .eq('utilisateur_id', user.id)
                .eq('action', 'Terminer');
        }
        fetchStats();
    };

    const currentLevel = Math.floor(totalXP / 100) + 1;
    const xpInThisLevel = totalXP % 100;
    const maxChartCount = Math.max(...weeklyStats.map(s => s.count), 5);

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

    // Calculate alerts
    const urgentTasks = tasks.filter(t => t.statut !== 'terminee' && t.date_debut && t.date_echeance && getTimeStatus(t.date_debut, t.date_echeance).state === 'urgent').length;
    const overdueTasks = tasks.filter(t => t.statut !== 'terminee' && t.date_debut && t.date_echeance && getTimeStatus(t.date_debut, t.date_echeance).state === 'overdue').length;

    const columns = {
        en_attente: {
            title: 'À faire',
            tasks: tasks.filter(t => !t.statut || t.statut === 'en_attente')
        },
        en_cours: {
            title: 'En cours',
            tasks: tasks.filter(t => t.statut === 'en_cours')
        },
        terminee: {
            title: 'Terminée',
            tasks: tasks.filter(t => t.statut === 'terminee')
        }
    };

    return (
        <div className="dashboard-container">
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
            <div className="dashboard-fixed-top">
                {/* Header */}
                <div className="header">
                    <div className="header-user">
                        <img
                            src={user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=" + (user.user_metadata?.full_name || user.email)}
                            alt="Avatar"
                            className="avatar"
                        />
                        <div>
                            <h2 className="greeting-title">Bonjour, {user.user_metadata?.full_name || 'Utilisateur'} !</h2>
                            <p className="greeting-subtitle">Mode Concentration</p>
                        </div>
                    </div>
                    <div className="header-actions">
                        <button className="icon-button" onClick={() => onNavigate('notifications')}>
                            <span className="material-symbols-outlined">notifications</span>
                        </button>
                        <button className="icon-button" onClick={onSignOut}>
                            <span className="material-symbols-outlined">logout</span>
                        </button>
                    </div>
                </div>

                {/* Alert Banner */}
                {(urgentTasks > 0 || overdueTasks > 0) && (
                    <div className="alert-banner">
                        <span className="material-symbols-outlined alert-icon">warning</span>
                        <div className="alert-text">
                            <strong>Attention :</strong> Vous avez {overdueTasks > 0 ? `${overdueTasks} tâche(s) en retard` : ''}
                            {overdueTasks > 0 && urgentTasks > 0 ? ' et ' : ''}
                            {urgentTasks > 0 ? `${urgentTasks} tâche(s) urgente(s)` : ''}.
                        </div>
                    </div>
                )}
            </div>{/* end dashboard-fixed-top */}

            {/* Scrollable content */}
            <div className="dashboard-scroll">
                {/* Gamification Stats */}
                <div className="stats-hero">
                    <div className="level-card">
                        <div className="level-header">
                            <div className="level-info">
                                <p>Niveau Actuel</p>
                                <h2>Niveau {currentLevel}</h2>
                            </div>
                            <div className="xp-badge">
                                {totalXP} XP Total
                            </div>
                        </div>
                        <div className="xp-progress-bg">
                            <div className="xp-progress-fill" style={{ width: `${xpInThisLevel}%` }}></div>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right' }}>
                            {xpInThisLevel} / 100 XP
                        </p>
                    </div>

                    <div className="weekly-chart-card">
                        <h3 className="chart-title">
                            <span className="material-symbols-outlined">bar_chart</span>
                            Activité des 7 derniers jours
                        </h3>
                        <div className="chart-bars">
                            {weeklyStats.map((stat, i) => {
                                const heightPercent = Math.max((stat.count / maxChartCount) * 100, 4);
                                return (
                                    <div key={i} className={`chart-col ${stat.isToday ? 'today' : ''}`}>
                                        <div className="bar-bg">
                                            <div className="bar-fill" style={{ height: `${heightPercent}%` }}></div>
                                        </div>
                                        <span className="day-label">{stat.dayName}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* AI Advice Card */}
                <div className="ai-advice-card">
                    <div className="ai-blur-blob"></div>
                    <div className="ai-advice-header">
                        <span className="material-symbols-outlined ai-icon">auto_awesome</span>
                        <span className="ai-label">Conseil IA du Jour</span>
                    </div>
                    <p className="ai-content">"{advice}"</p>
                </div>

                {/* Kanban Board */}
                <div className="tasks-header">
                    <h2 className="tasks-title">Mes Tâches</h2>
                    <button className="view-all" onClick={() => fetchTasks()}>Actualiser</button>
                </div>

                <div className="kanban-board-container">
                    {loading ? (
                        <p style={{ textAlign: 'center', opacity: 0.5, width: '100%' }}>Chargement des tâches...</p>
                    ) : tasks.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem', width: '100%', minHeight: '50vh' }}>
                            <div style={{ width: '100%', maxWidth: '350px', aspectRatio: '1/1', opacity: 0.9 }}>
                                <DotLottieReact
                                    src="https://lottie.host/31f1660d-f0aa-4783-88dc-e7a599cf3762/CzoE9pdrSW.lottie"
                                    loop
                                    autoplay
                                />
                            </div>
                            <h3 style={{ margin: '1rem 0 0', fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', textAlign: 'center' }}>
                                Aucune tâche individuelle
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
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>add</span>
                                Nouvelle tâche
                            </button>
                        </div>
                    ) : (
                        <DragDropContext 
                            onDragStart={() => setIsDragging(true)}
                            onDragEnd={(result) => { setIsDragging(false); onDragEnd(result); }}
                        >
                            <div className="kanban-columns-wrapper" ref={scrollContainerRef}>
                                {Object.entries(columns).map(([columnId, column]) => (
                                    <div key={columnId} className="kanban-column-container">
                                        <div className="kanban-column-header">
                                            <h3>{column.title}</h3>
                                            <span className="kanban-column-count">{column.tasks.length}</span>
                                        </div>
                                        <Droppable droppableId={columnId}>
                                            {(provided, snapshot) => (
                                                <div
                                                    className={`kanban-column ${snapshot.isDraggingOver ? 'dragging-over' : ''}`}
                                                    ref={provided.innerRef}
                                                    {...provided.droppableProps}
                                                >
                                                    {column.tasks.map((task, index) => {
                                                        const timeStatus = (task.date_debut && task.date_echeance) ? getTimeStatus(task.date_debut, task.date_echeance) : { percent: 0, state: 'normal' };
                                                        const isCompleted = columnId === 'terminee';

                                                        return (
                                                            <Draggable key={task.id} draggableId={task.id} index={index}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        className={`task-item kanban-task-item ${snapshot.isDragging ? 'is-dragging' : ''}`}
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        onClick={() => onNavigate('taskDetails', task)}
                                                                        style={{ 
                                                                            ...provided.draggableProps.style,
                                                                        }}
                                                                    >
                                                                        <div
                                                                            className={`task-checkbox ${isCompleted ? 'checked' : ''}`}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleTaskStatus(task);
                                                                            }}
                                                                        >
                                                                            {isCompleted && <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>check</span>}
                                                                        </div>
                                                                        <div className="task-details">
                                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                                <h3 className={`task-title ${isCompleted ? 'completed' : ''}`}>
                                                                                    {task.titre}
                                                                                </h3>
                                                                            </div>
                                                                            <div className="task-meta" style={{ marginTop: '0.5rem' }}>
                                                                                {task.date_echeance && (
                                                                                    <span className="task-chip">
                                                                                        {new Date(task.date_echeance).toLocaleDateString()} {new Date(task.date_echeance).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                                    </span>
                                                                                )}
                                                                                {!isCompleted && timeStatus.state === 'overdue' && (
                                                                                    <span className="status-badge error">Retard</span>
                                                                                )}
                                                                                {!isCompleted && timeStatus.state === 'urgent' && (
                                                                                    <span className="status-badge warning">Urgente</span>
                                                                                )}
                                                                                {task.est_important && (
                                                                                    <span className="task-chip priority">Important</span>
                                                                                )}
                                                                            </div>
                                                                            {task.date_debut && task.date_echeance && !isCompleted && (
                                                                                <div className="task-time-progress-bg">
                                                                                    <div
                                                                                        className={`task-time-progress-fill ${timeStatus.state}`}
                                                                                        style={{ width: `${timeStatus.percent}%` }}
                                                                                    ></div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        );
                                                    })}
                                                    {provided.placeholder}
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                ))}
                            </div>
                        </DragDropContext>
                    )}
                </div>
            </div>{/* end dashboard-scroll */}

            {/* FAB */}
            <button className="fab-button" onClick={() => onNavigate('create')}>
                <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>add</span>
            </button>

            {/* Bottom Nav */}
            <div className="bottom-nav-container">
                <div className="bottom-nav">
                    <button className="nav-item active">
                        <span className="material-symbols-outlined">bar_chart</span>
                        <span className="nav-label">Stats</span>
                    </button>
                    <button className="nav-item" onClick={() => onNavigate('collective')}>
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
