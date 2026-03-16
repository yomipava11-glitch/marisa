import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import './AiAssistant.css';

interface AiAssistantProps {
    user: any;
    onNavigate: (page: string) => void;
}

// Animated health score ring
function HealthRing({ score }: { score: number }) {
    const r = 54;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    const color = score >= 86 ? '#22c55e' : score >= 71 ? '#4ade80' : score >= 51 ? '#f59e0b' : score >= 31 ? '#f97316' : '#ef4444';
    const label = score >= 86 ? 'Excellent' : score >= 71 ? 'Bon' : score >= 51 ? 'Correct' : score >= 31 ? 'Attention' : 'Critique';

    return (
        <div className="health-ring-wrapper">
            <svg viewBox="0 0 128 128" className="health-ring-svg">
                <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle
                    cx="64" cy="64" r={r} fill="none"
                    stroke={color} strokeWidth="10"
                    strokeDasharray={`${dash} ${circ}`}
                    strokeLinecap="round"
                    transform="rotate(-90 64 64)"
                    className="health-ring-progress"
                />
                <text x="64" y="58" textAnchor="middle" fill="#f8fafc" fontSize="28" fontWeight="800">
                    {score}
                </text>
                <text x="64" y="78" textAnchor="middle" fill={color} fontSize="11" fontWeight="600" style={{ textTransform: 'uppercase' }}>
                    {label}
                </text>
            </svg>
        </div>
    );
}

// Stat card
function StatCard({ value, label, icon, color }: { value: number; label: string; icon: string; color: string }) {
    return (
        <div className="sm-stat-card" style={{ borderColor: `${color}22` }}>
            <div className="sm-stat-icon" style={{ background: `${color}15`, color }}>
                <span className="material-symbols-outlined">{icon}</span>
            </div>
            <span className="sm-stat-value">{value}</span>
            <span className="sm-stat-label">{label}</span>
        </div>
    );
}

export function AiAssistant({ onNavigate }: AiAssistantProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { fetchAnalysis(); }, []);

    const fetchAnalysis = async (retryCount = 0) => {
        setLoading(true);
        setError(null);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error('Session expirée');

            const { data: result, error: fnError } = await supabase.functions.invoke('ai-scrum-master', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (fnError) {
                // Try to extract the actual error message
                let msg = fnError.message;
                try {
                    if (fnError.context) {
                        const ctx = await fnError.context.json();
                        msg = ctx.error || msg;
                    }
                } catch { }
                throw new Error(msg);
            }
            setData(result);
        } catch (err: any) {
            console.error('AI Analysis error:', err);
            // Auto-retry once on server errors (cold start, timeout)
            if (retryCount < 1) {
                console.log('Retrying AI analysis...');
                setTimeout(() => fetchAnalysis(retryCount + 1), 1500);
                return;
            }
            setError(err.message || 'Erreur de connexion');
        } finally {
            if (retryCount > 0 || !error) setLoading(false);
        }
    };

    const santeColor = (s: string) => {
        if (s === 'bon') return '#22c55e';
        if (s === 'correct') return '#f59e0b';
        if (s === 'a_risque') return '#f97316';
        return '#ef4444';
    };

    const santeLabel = (s: string) => {
        if (s === 'bon') return 'Bon';
        if (s === 'correct') return 'Correct';
        if (s === 'a_risque') return 'À risque';
        return 'Critique';
    };

    const alertColor = (t: string) => {
        if (t === 'danger') return { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)', color: '#ef4444', icon: 'error' };
        if (t === 'warning') return { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', color: '#f59e0b', icon: 'warning' };
        return { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', color: '#60a5fa', icon: 'info' };
    };

    const priorityColor = (p: string) => {
        if (p === 'High') return '#ef4444';
        if (p === 'Medium') return '#f59e0b';
        return '#22c55e';
    };

    const catIcon = (c: string) => {
        if (c === 'planification') return 'calendar_month';
        if (c === 'productivite') return 'trending_up';
        if (c === 'equipe') return 'group';
        return 'priority_high';
    };

    return (
        <div className="sm-container">
            {/* Ambient background */}
            <div className="sm-bg-orb sm-bg-orb-1" />
            <div className="sm-bg-orb sm-bg-orb-2" />

            {/* Header */}
            <header className="sm-header">
                <button className="sm-back-btn" onClick={() => onNavigate('back')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="sm-header-center">
                    <div className="sm-header-icon">
                        <span className="material-symbols-outlined">psychology</span>
                    </div>
                    <div>
                        <h1 className="sm-title">Scrum Master IA</h1>
                        <p className="sm-subtitle">Analyse complète du projet</p>
                    </div>
                </div>
                <button className="sm-refresh-btn" onClick={() => fetchAnalysis()} disabled={loading} title="Re-analyser">
                    <span className={`material-symbols-outlined ${loading ? 'spinning' : ''}`}>refresh</span>
                </button>
            </header>

            <div className="sm-scroll">
                {/* Loading state */}
                {loading && (
                    <div className="sm-loading">
                        <div className="sm-loading-ring" />
                        <p className="sm-loading-text">Analyse approfondie en cours...</p>
                        <p className="sm-loading-sub">Lecture des tâches, sous-tâches, membres et logs</p>
                    </div>
                )}

                {/* Error state */}
                {!loading && error && (
                    <div className="sm-error-card">
                        <span className="material-symbols-outlined">cloud_off</span>
                        <p>{error}</p>
                        <button onClick={() => fetchAnalysis()}>Réessayer</button>
                    </div>
                )}

                {/* Main content */}
                {!loading && data && (
                    <>
                        {/* ═══ HEALTH SCORE HERO ═══ */}
                        <section className="sm-hero-section">
                            <HealthRing score={data.health_score || 50} />
                            <p className="sm-health-summary">{data.health_summary}</p>
                        </section>

                        {/* ═══ STATS GRID ═══ */}
                        {data.stats && (
                            <section className="sm-section sm-stats-grid">
                                <StatCard value={data.stats.totalTasks} label="Tâches" icon="task" color="#8b5cf6" />
                                <StatCard value={data.stats.individualTasks} label="Individuelles" icon="person" color="#60a5fa" />
                                <StatCard value={data.stats.collectiveTasks} label="Collectives" icon="groups" color="#a78bfa" />
                                <StatCard value={data.stats.importantTasks} label="Importantes" icon="priority_high" color="#f59e0b" />
                                <StatCard value={data.stats.overdueTasks} label="En retard" icon="schedule" color="#ef4444" />
                                <StatCard value={data.stats.completedSubs} label="Sous-tâches OK" icon="check_circle" color="#22c55e" />
                            </section>
                        )}

                        {/* ═══ ALERTS ═══ */}
                        {data.alerts && data.alerts.length > 0 && (
                            <section className="sm-section">
                                <h3 className="sm-section-title">
                                    <span className="material-symbols-outlined" style={{ color: '#ef4444' }}>notifications_active</span>
                                    Alertes
                                </h3>
                                <div className="sm-alerts-list">
                                    {data.alerts.map((a: any, i: number) => {
                                        const c = alertColor(a.type);
                                        return (
                                            <div key={i} className="sm-alert-card" style={{ background: c.bg, borderColor: c.border }}>
                                                <span className="material-symbols-outlined" style={{ color: c.color, fontSize: '20px' }}>{a.icon || c.icon}</span>
                                                <p>{a.text}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* ═══ TASK ANALYSES ═══ */}
                        {data.task_analyses && data.task_analyses.length > 0 && (
                            <section className="sm-section">
                                <h3 className="sm-section-title">
                                    <span className="material-symbols-outlined" style={{ color: '#a78bfa' }}>analytics</span>
                                    Analyse par Tâche
                                </h3>
                                <div className="sm-task-analyses">
                                    {data.task_analyses.map((ta: any, i: number) => (
                                        <div key={i} className="sm-task-analysis-card">
                                            <div className="sm-ta-header">
                                                <div className="sm-ta-sante-dot" style={{ background: santeColor(ta.sante) }} />
                                                <div className="sm-ta-info">
                                                    <h4>{ta.titre}</h4>
                                                    <div className="sm-ta-badges">
                                                        <span className="sm-ta-type-badge">{ta.type === 'collectif' ? '👥 Collectif' : '👤 Individuel'}</span>
                                                        <span className="sm-ta-sante-badge" style={{ color: santeColor(ta.sante), borderColor: `${santeColor(ta.sante)}33` }}>
                                                            {santeLabel(ta.sante)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="sm-ta-progress-wrap">
                                                <div className="sm-ta-progress-bar">
                                                    <div className="sm-ta-progress-fill" style={{ width: `${ta.progression_pct || 0}%`, background: santeColor(ta.sante) }} />
                                                </div>
                                                <span className="sm-ta-progress-text">{ta.progression_pct || 0}%</span>
                                            </div>

                                            {/* Risk */}
                                            {ta.risque && (
                                                <div className="sm-ta-risk">
                                                    <span className="material-symbols-outlined">warning</span>
                                                    <span>{ta.risque}</span>
                                                </div>
                                            )}

                                            {/* Advice */}
                                            {ta.conseil && (
                                                <div className="sm-ta-advice">
                                                    <span className="material-symbols-outlined">auto_awesome</span>
                                                    <span>{ta.conseil}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ═══ DAILY FOCUS ═══ */}
                        {data.daily_focus && data.daily_focus.length > 0 && (
                            <section className="sm-section">
                                <h3 className="sm-section-title">
                                    <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>local_fire_department</span>
                                    Focus du Jour
                                </h3>
                                <div className="sm-focus-list">
                                    {data.daily_focus.map((f: any, i: number) => (
                                        <div key={i} className="sm-focus-card">
                                            <div className="sm-focus-priority" style={{ background: priorityColor(f.priority) }}>
                                                {i + 1}
                                            </div>
                                            <div className="sm-focus-content">
                                                <h4>{f.title}</h4>
                                                <p className="sm-focus-reason">{f.reason}</p>
                                            </div>
                                            <span className="sm-focus-priority-label" style={{ color: priorityColor(f.priority) }}>
                                                {f.priority}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ═══ SMART ASSIGNMENTS ═══ */}
                        {data.smart_assignments && data.smart_assignments.length > 0 && (
                            <section className="sm-section">
                                <h3 className="sm-section-title">
                                    <span className="material-symbols-outlined" style={{ color: '#60a5fa' }}>group_add</span>
                                    Assignations Intelligentes
                                </h3>
                                <div className="sm-assignments-list">
                                    {data.smart_assignments.map((a: any, i: number) => (
                                        <div key={i} className="sm-assignment-card">
                                            <div className="sm-assign-top">
                                                <div className="sm-assign-avatar">
                                                    <span className="material-symbols-outlined">person</span>
                                                </div>
                                                <div className="sm-assign-info">
                                                    <h5>{a.taskTitle}</h5>
                                                    <p>→ <strong>{a.suggestedUser}</strong></p>
                                                </div>
                                            </div>
                                            <div className="sm-assign-reason">
                                                <span className="material-symbols-outlined">auto_awesome</span>
                                                {a.reason}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* ═══ RECOMMENDATIONS ═══ */}
                        {data.recommendations && data.recommendations.length > 0 && (
                            <section className="sm-section">
                                <h3 className="sm-section-title">
                                    <span className="material-symbols-outlined" style={{ color: '#22c55e' }}>tips_and_updates</span>
                                    Recommandations
                                </h3>
                                <div className="sm-reco-list">
                                    {data.recommendations.map((r: any, i: number) => (
                                        <div key={i} className="sm-reco-card">
                                            <div className="sm-reco-icon">
                                                <span className="material-symbols-outlined">{r.icon || catIcon(r.category)}</span>
                                            </div>
                                            <div className="sm-reco-content">
                                                <span className="sm-reco-cat">{r.category}</span>
                                                <p>{r.text}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Footer */}
                        <div className="sm-footer">
                            <p>Analyse générée par IA • Données en temps réel</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
