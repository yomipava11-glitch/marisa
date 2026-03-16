import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import confetti from 'canvas-confetti';
import './Dashboard.css';

export function Dashboard({ user, onSignOut, onNavigate }: { user: any, onSignOut: () => void, onNavigate: (page: string, data?: any) => void }) {
    const [advice, setAdvice] = useState<string>("Chargement de vos conseils productivité...");
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalXP, setTotalXP] = useState<number>(0);
    const [weeklyStats, setWeeklyStats] = useState<{ dayName: string, count: number, isToday: boolean }[]>([]);

    useEffect(() => {
        fetchAdvice();
        fetchTasks();
        fetchStats();

        // Realtime subscription for tasks
        const channel = supabase.channel('public:taches')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'taches', filter: `createur_id=eq.${user.id}` }, () => {
                fetchTasks();
            })
            .subscribe();

        return () => {
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
            setTotalXP(data.length * 10); // 10 XP per task

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

        if (data) setTasks(data);
        setLoading(false);
    };

    const toggleTaskStatus = async (task: any) => {
        const newStatus = task.statut === 'terminee' ? 'en_cours' : 'terminee';
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

        fetchTasks();
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

    return (
        <div className="dashboard-container">
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
                            <h2 className="greeting-title">Hello, {user.user_metadata?.full_name || 'User'}!</h2>
                            <p className="greeting-subtitle">Focus Mode On</p>
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
                                <h2>Level {currentLevel}</h2>
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
                        <span className="ai-label">Daily AI Advice</span>
                    </div>
                    <p className="ai-content">"{advice}"</p>
                </div>

                {/* Tasks List */}
                <div className="tasks-header">
                    <h2 className="tasks-title">My Tasks</h2>
                    <button className="view-all">View All</button>
                </div>

                <div className="tasks-list">
                    {loading ? (
                        <p style={{ textAlign: 'center', opacity: 0.5 }}>Loading tasks...</p>
                    ) : tasks.length === 0 ? (
                        <p style={{ textAlign: 'center', opacity: 0.5 }}>No individual tasks found.</p>
                    ) : (
                        tasks.map(task => {
                            const timeStatus = (task.date_debut && task.date_echeance) ? getTimeStatus(task.date_debut, task.date_echeance) : { percent: 0, state: 'normal' };
                            const isCompleted = task.statut === 'terminee';

                            return (
                                <div key={task.id} className="task-item" style={{ cursor: 'pointer' }} onClick={() => onNavigate('taskDetails', task)}>
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
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 className={`task-title ${isCompleted ? 'completed' : ''}`}>
                                                {task.titre}
                                            </h3>
                                            {!isCompleted && timeStatus.state === 'overdue' && (
                                                <span className="status-badge error">Retard</span>
                                            )}
                                            {!isCompleted && timeStatus.state === 'urgent' && (
                                                <span className="status-badge warning">Urgente</span>
                                            )}
                                        </div>
                                        <div className="task-meta">
                                            {task.date_echeance && (
                                                <span className="task-chip">
                                                    {new Date(task.date_echeance).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
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
                                    <span className="material-symbols-outlined" style={{ color: '#64748b' }}>more_vert</span>
                                </div>
                            )
                        })
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
