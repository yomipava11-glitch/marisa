import { useState, useRef, useEffect } from 'react';
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

    const [allProfiles, setAllProfiles] = useState<any[]>([]);
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    
    // Voice Recording states
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        const { data } = await supabase
            .from('contacts_permanents')
            .select('*, profils!contacts_permanents_contact_id_fkey(id, nom, avatar_url, email)')
            .eq('proprietaire_id', user.id)
            .eq('statut', 'accepte');
            
        if (data) {
            const contactsList = data.map((c: any) => c.profils).filter(Boolean);
            setAllProfiles(contactsList as any[]);
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                await handleTranscription(audioBlob);
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Microphone access error:", error);
            alert("Erreur d'accès au microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const handleTranscription = async (audioBlob: Blob) => {
        setIsTranscribing(true);
        try {
            const { data: session } = await supabase.auth.getSession();
            const token = session?.session?.access_token;
            if (!token) throw new Error("Non authentifié");

            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('currentDate', new Date().toISOString().split('T')[0]);
            
            const membersList = allProfiles.map(p => ({ id: p.id, nom: p.nom }));
            formData.append('membersList', JSON.stringify(membersList));

            const { data, error } = await supabase.functions.invoke('assistant-vocal-creation-tache', {
                body: formData,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (error) {
                if (error.context) {
                    const ctx = await error.context.json();
                    throw new Error(ctx.error || ctx.message || "Erreur inconnue");
                }
                throw error;
            }

            if (data && data.task_draft) {
                const draft = data.task_draft;
                if (draft.titre) setTitle(draft.titre);
                if (draft.description) setDescription(draft.description);
                if (draft.est_collectif !== undefined) setType(draft.est_collectif ? 'collective' : 'individual');
                if (draft.est_prioritaire !== undefined) setEstImportant(draft.est_prioritaire);
                
                if (draft.date_debut) setStartDate(draft.date_debut.slice(0, 16));
                else setStartDate('');

                if (draft.date_fin) setDueDate(draft.date_fin.split('T')[0]);
                if (draft.heure_fin) setDueTime(draft.heure_fin);

                if (draft.membres_assignes && Array.isArray(draft.membres_assignes)) {
                    setSelectedMembers(draft.membres_assignes);
                }
            }
        } catch (err: any) {
            console.error("Erreur IA:", err);
            alert("Erreur lors de la création vocale: " + (err.message || "Réseau"));
        } finally {
            setIsTranscribing(false);
        }
    };

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
            const membersToInsert = [];
            membersToInsert.push({
                tache_id: task.id,
                utilisateur_id: user.id,
                role: 'admin',
                statut: 'accepte'
            });

            if (selectedMembers.length > 0) {
                 selectedMembers.forEach(id => {
                     if (id !== user.id) {
                         membersToInsert.push({
                             tache_id: task.id,
                             utilisateur_id: id,
                             role: 'interprete',
                             statut: 'en_attente'
                         });
                     }
                 });
            }

            await supabase.from('membres_tache').insert(membersToInsert);

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
                {/* Voice AI Banner */}
                <div style={{ marginBottom: '1.5rem' }}>
                    <div className={`ai-voice-banner ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`}
                         onClick={isRecording ? stopRecording : (isTranscribing ? undefined : startRecording)}
                         style={{ 
                             display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', 
                             borderRadius: '1rem', background: isRecording ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                             border: isRecording ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                             cursor: isTranscribing ? 'not-allowed' : 'pointer', transition: 'all 0.3s'
                         }}>
                        <div style={{
                            width: '3rem', height: '3rem', borderRadius: '50%', 
                            background: isRecording ? '#ef4444' : '#22c55e', 
                            display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center',
                            boxShadow: isRecording ? '0 0 15px rgba(239,68,68,0.5)' : 'none',
                            animation: isRecording ? 'pulse 1.5s infinite' : 'none'
                        }}>
                            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '1.5rem', marginTop: '2px' }}>
                                {isRecording ? 'stop' : (isTranscribing ? 'hourglass_empty' : 'mic')}
                            </span>
                        </div>
                        <div style={{ flex: 1 }}>
                            <h3 style={{ margin: 0, fontSize: '1rem', color: isRecording ? '#ef4444' : '#34d399', fontWeight: 600 }}>
                                {isRecording ? 'Écoute en cours...' : (isTranscribing ? 'Analyse par l\'IA...' : 'Création Vocale')}
                            </h3>
                            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                                {isRecording ? 'Touchez pour arrêter' : (isTranscribing ? 'Transformation magique en tâche...' : 'Dictez le titre, les dates, les personnes...')}
                            </p>
                        </div>
                        {!isRecording && !isTranscribing && (
                            <span className="material-symbols-outlined" style={{ color: '#34d399' }}>auto_awesome</span>
                        )}
                    </div>
                </div>

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
                        <label className="field-label">Membres de l'équipe (assignés par l'IA)</label>
                        <div className="team-members-row">
                            <img src={user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=" + (user.user_metadata?.full_name || 'U')} className="member-avatar selected" alt="You" />
                            {selectedMembers.filter(id => id !== user.id).map(id => {
                                const profile = allProfiles.find(p => p.id === id);
                                if (!profile) return null;
                                return (
                                    <img key={id} src={profile.avatar_url || "https://ui-avatars.com/api/?name=" + profile.nom} className="member-avatar selected" alt={profile.nom} title={profile.nom} />
                                );
                            })}
                            <button className="add-member-btn" title="L'ajout manuel arrivera bientôt">
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
