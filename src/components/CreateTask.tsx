import { useState } from 'react';
import { supabase } from '../lib/supabase';
import './CreateTask.css';

export function CreateTask({ user, onNavigate }: { user: any, onNavigate: (page: string) => void }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('individual');
    const [isLoading, setIsLoading] = useState(false); // Changed from 'loading' to 'isLoading'

    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState(() => {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    });
    const [dueTime, setDueTime] = useState('10:00');
    const [estImportant, setEstImportant] = useState(false); // New Important Flag

    const handleCreate = async () => {
        if (!title) return;
        setIsLoading(true); // Changed from 'setLoading' to 'setIsLoading'

        let icone_url = null;
        try {
            // Call AI Edge Function for icon generation
            const { data } = await supabase.functions.invoke('generer-icone-tache', {
                body: { description: title + " " + description }
            });
            if (data && data.icone_url) {
                icone_url = data.icone_url;
            }
        } catch (e) {
            console.error("AI Icon generation failed", e);
        }

        // Combine date and time
        const dateEcheance = new Date(`${dueDate}T${dueTime}:00`).toISOString();
        const dateDebut = startDate ? new Date(startDate).toISOString() : new Date().toISOString();

        const { data: task } = await supabase.from('taches').insert({
            createur_id: user.id,
            titre: title,
            description,
            est_collectif: type === 'collective',
            icone_url,
            date_debut: dateDebut,
            date_echeance: dateEcheance,
            est_important: estImportant // Added est_important
        }).select().single();

        if (task && type === 'collective') {
            // Auto-add creator as admin member
            await supabase.from('membres_tache').insert({
                tache_id: task.id,
                utilisateur_id: user.id,
                role: 'admin'
            });

            // Log creation in activity feed
            await supabase.from('flux_activite').insert({
                tache_id: task.id,
                utilisateur_id: user.id,
                action: 'a_cree_tache_collective'
            });
        }

        setIsLoading(false); // Changed from 'setLoading' to 'setIsLoading'
        onNavigate(type === 'collective' ? 'collective' : 'dashboard');
    };

    return (
        <div className="create-task-container">
            <div className="bg-blur-top"></div>
            <div className="bg-blur-bottom"></div>

            <header className="page-header">
                <button className="icon-btn-back" onClick={() => onNavigate('back')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h2 className="screen-title">Nouvelle Tâche</h2>
                <div style={{ width: '2.5rem' }}></div>
            </header>

            <div className="scroll-content">
                {/* Title */}
                <div className="form-field">
                    <label className="field-label">Titre de la tâche</label>
                    <div className="glass-input-container">
                        <input
                            type="text"
                            className="clean-input"
                            placeholder="Ex: Audit du système de design"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                        />
                    </div>
                </div>

                {/* Description */}
                <div className="form-field">
                    <div className="field-label">
                        <span>Description</span>
                        <button className="ai-assist-btn">
                            <span className="material-symbols-outlined" style={{ fontSize: '0.875rem' }}>auto_awesome</span>
                            AI Assist
                        </button>
                    </div>
                    <div className="glass-input-container">
                        <textarea
                            className="clean-textarea"
                            placeholder="Décrivez les objectifs et livrables..."
                            rows={3}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        ></textarea>
                    </div>
                </div>

                {/* Task Type */}
                <div className="form-field">
                    <label className="field-label">Type de tâche</label>
                    <div className="type-toggle">
                        <label className="toggle-label">
                            <input
                                type="radio"
                                name="task_type"
                                value="individual"
                                className="toggle-input"
                                checked={type === 'individual'}
                                onChange={() => setType('individual')}
                            />
                            <div className="toggle-btn">Individuelle</div>
                        </label>
                        <label className="toggle-label">
                            <input
                                type="radio"
                                name="task_type"
                                value="collective"
                                className="toggle-input"
                                checked={type === 'collective'}
                                onChange={() => setType('collective')}
                            />
                            <div className="toggle-btn">Collective</div>
                        </label>
                    </div>
                </div>

                {/* Important Toggle */}
                <div className="form-field">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', background: estImportant ? 'rgba(0, 166, 81, 0.08)' : 'rgba(255,255,255,0.03)', padding: '1rem 1.15rem', borderRadius: '1rem', border: estImportant ? '1px solid rgba(0, 166, 81, 0.25)' : '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.25s ease' }}>
                        <input
                            type="checkbox"
                            checked={estImportant}
                            onChange={(e) => setEstImportant(e.target.checked)}
                            style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.375rem', accentColor: '#00a651' }}
                        />
                        <span style={{ fontWeight: '600', fontSize: '0.95rem', color: estImportant ? '#34d399' : '#94a3b8', transition: 'color 0.25s' }}>⭐ Tâche prioritaire</span>
                    </label>
                </div>

                {/* Collaborative Section (Demo only for members) */}
                {type === 'collective' && (
                    <div className="form-field">
                        <label className="field-label">Membres de l'équipe</label>
                        <div className="team-members-row">
                            <img src={user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=" + (user.user_metadata?.full_name || 'U')} className="member-avatar selected" alt="You" />
                            <button className="add-member-btn">
                                <span className="material-symbols-outlined">add</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Date Picker (Start & End inline) */}
                <div className="form-field" style={{ marginBottom: '2.5rem' }}>
                    <div className="date-time-row">
                        {/* Start Date */}
                        <div className="date-picker-box" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <label className="field-label" style={{ padding: 0 }}>Date de début <span style={{ textTransform: 'none', fontWeight: 'normal', color: '#475569' }}>(optionnel)</span></label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', background: 'rgba(0,0,0,0.15)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <span className="material-symbols-outlined picker-icon" style={{ color: '#34d399', fontSize: '1.25rem' }}>calendar_month</span>
                                <input
                                    type="datetime-local"
                                    className="native-date-input"
                                    style={{ flex: 1, padding: 0, cursor: 'pointer' }}
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* End Date */}
                        <div className="date-picker-box" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <label className="field-label" style={{ padding: 0 }}>Date de fin</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', background: 'rgba(0,0,0,0.15)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                                <span className="material-symbols-outlined picker-icon" style={{ color: '#ef4444', fontSize: '1.25rem' }}>event_available</span>
                                <div style={{ display: 'flex', gap: '0.75rem', flex: 1, alignItems: 'center' }}>
                                    <input
                                        type="date"
                                        className="native-date-input"
                                        style={{ flex: 1, padding: 0, cursor: 'pointer' }}
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                    />
                                    <div style={{ width: '1.5px', height: '1.5rem', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                                    <input
                                        type="time"
                                        className="native-date-input"
                                        style={{ width: 'auto', minWidth: '6.5rem', padding: 0, cursor: 'pointer', textAlign: 'center' }}
                                        value={dueTime}
                                        onChange={e => setDueTime(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky Bottom Action */}
            <div className="bottom-action-area">
                <button className="create-btn" onClick={handleCreate} disabled={isLoading || !title}>
                    {isLoading ? 'Génération IA en cours...' : 'Créer la tâche'}
                    {!isLoading && <span className="material-symbols-outlined">arrow_forward</span>}
                </button>
            </div>
        </div>
    );
}
