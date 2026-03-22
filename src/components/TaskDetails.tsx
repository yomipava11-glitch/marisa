import React, { useEffect, useState, useRef } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { supabase } from '../lib/supabase';
import confetti from 'canvas-confetti';
import './TaskDetails.css';
import { InviteMemberModal } from './InviteMemberModal';
import { LogSection } from './LogSection';
import { AiTaskAnalysisPopup } from './AiTaskAnalysisPopup';

interface TaskDetailsProps {
    task: any; // The main task passed from previous screen
    onNavigate: (page: string) => void;
    user: any; // Add user to check if they are the creator
}

export function TaskDetails({ task, onNavigate, user }: TaskDetailsProps) {
    const [subTasks, setSubTasks] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [newItemText, setNewItemText] = useState('');
    const [logType, setLogType] = useState<'fait' | 'probleme' | 'prevu'>('fait');
    const [activeTab, setActiveTab] = useState<'subtasks' | 'logs'>('logs');
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [assignMenuOpen, setAssignMenuOpen] = useState<string | null>(null);
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

    // AI Analysis State
    const [isAiPopupOpen, setIsAiPopupOpen] = useState(false);
    const [aiAnalysisText, setAiAnalysisText] = useState<any>(null);
    const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<'task' | 'subtask'>('task');
    const [editTargetId, setEditTargetId] = useState<string>('');
    const [editTitle, setEditTitle] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [currentTask, setCurrentTask] = useState(task);

    // Audio Recording State
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Audio Subtask Recording State
    const [isSubtaskRecording, setIsSubtaskRecording] = useState(false);
    const [isSubtaskTranscribing, setIsSubtaskTranscribing] = useState(false);
    const subtaskMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const subtaskAudioChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        if (!task?.id) return;

        fetchSubTasks();
        fetchLogs();
        if (task.est_collectif) {
            fetchMembers();
        }

        // Realtime subscription for subtasks
        const subChannel = supabase.channel(`subtasks-${task.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'sous_taches', filter: `tache_id=eq.${task.id}` }, () => {
                fetchSubTasks();
            })
            .subscribe();

        // Realtime subscription for logs
        const logChannel = supabase.channel(`logs-${task.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'logs_tache', filter: `tache_id=eq.${task.id}` }, () => {
                fetchLogs();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(subChannel);
            supabase.removeChannel(logChannel);
        };
    }, [task?.id]);

    const fetchMembers = async () => {
        const { data } = await supabase
            .from('membres_tache')
            .select('utilisateur_id, role, profils(nom, avatar_url)')
            .eq('tache_id', task.id);

        if (data) setMembers(data);
    };

    const fetchSubTasks = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('sous_taches')
            .select('*, profils(nom, avatar_url)')
            .eq('tache_id', task.id)
            .order('cree_le', { ascending: true });

        if (data && !error) {
            setSubTasks(data);
        } else {
            console.error('Erreur subtasks', error);
        }
        setLoading(false);
    };

    const fetchLogs = async () => {
        const { data, error } = await supabase
            .from('logs_tache')
            .select('*, profils(nom, avatar_url)')
            .eq('tache_id', task.id)
            .order('cree_le', { ascending: false });

        if (data && !error) {
            setLogs(data);
        } else {
            console.error('Erreur logs', error);
        }
    };

    const submitLog = async (logContent: string) => {
        if (!logContent.trim()) return;

        const newLog = {
            tache_id: task.id,
            utilisateur_id: user.id,
            type: logType,
            contenu: logContent.trim()
        };

        const { error } = await supabase.from('logs_tache').insert(newLog);
        if (!error) {
            fetchLogs();
            if (newItemText === logContent) {
                 setNewItemText('');
            }
        } else {
            console.error('Erreur insertion log:', error);
        }
    };

    const handleAddItem = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!newItemText.trim()) return;

        if (activeTab === 'subtasks' && isAdmin) {
            const newTask = {
                tache_id: task.id,
                titre: newItemText.trim(),
                statut: 'en_attente'
            };

            const { data, error } = await supabase
                .from('sous_taches')
                .insert(newTask)
                .select();

            if (data && !error) {
                setSubTasks([...subTasks, data[0]]);
                setNewItemText('');
            }
        } else if (activeTab === 'logs') {
            await submitLog(newItemText.trim());
        }
    };

    // --- AUDIO LOGIC ---
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
        } catch (err) {
            console.error("Erreur accès microphone:", err);
            alert("Impossible d'accéder au microphone.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
            // Free the microphone resource
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
        }
    };

    const handleTranscription = async (audioBlob: Blob) => {
        setIsTranscribing(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) return;

            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');

            const { data, error } = await supabase.functions.invoke('transcrire-audio', {
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
            
            if (data && data.texte) {
                // Instantly submit the transcribed text as a log
                await submitLog(data.texte);
            }
        } catch (err) {
            console.error("Erreur de transcription:", err);
            alert("La transcription a échoué.");
        } finally {
            setIsTranscribing(false);
        }
    };

    // --- AUDIO SUBTASK LOGIC ---
    const startSubtaskRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            subtaskMediaRecorderRef.current = new MediaRecorder(stream);
            subtaskAudioChunksRef.current = [];

            subtaskMediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    subtaskAudioChunksRef.current.push(event.data);
                }
            };

            subtaskMediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(subtaskAudioChunksRef.current, { type: 'audio/webm' });
                await handleSubtaskTranscription(audioBlob);
            };

            subtaskMediaRecorderRef.current.start();
            setIsSubtaskRecording(true);
        } catch (err) {
            console.error("Erreur accès microphone pour sous-tâche:", err);
            alert("Impossible d'accéder au microphone.");
        }
    };

    const stopSubtaskRecording = () => {
        if (subtaskMediaRecorderRef.current && subtaskMediaRecorderRef.current.state !== "inactive") {
            subtaskMediaRecorderRef.current.stop();
            subtaskMediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsSubtaskRecording(false);
        }
    };

    const handleSubtaskTranscription = async (audioBlob: Blob) => {
        setIsSubtaskTranscribing(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) return;

            const membersList = members.map(m => ({ id: m.utilisateur_id, nom: m.profils?.nom }));

            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            formData.append('currentDate', new Date().toISOString().split('T')[0]);
            formData.append('membersList', JSON.stringify(membersList));

            const { data, error } = await supabase.functions.invoke('assistant-vocal-tache', {
                body: formData,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (error) {
                if (error.context) {
                    const ctx = await error.context.json();
                    throw new Error(ctx.error || ctx.message || "Erreur interne de l'Edge Function");
                }
                throw error;
            }
            
            if (data && data.subtask && data.subtask.titre) {
                const draft = data.subtask;
                
                const newTask = {
                    tache_id: task.id,
                    titre: draft.titre,
                    statut: 'en_attente',
                    assigne_a: draft.assigne_a || null,
                    date_debut: draft.date_debut || null,
                    date_fin: draft.date_fin || null
                };

                const { data: inserted, error: insertError } = await supabase
                    .from('sous_taches')
                    .insert(newTask)
                    .select('*, profils:assigne_a(nom, avatar_url)');

                if (inserted && !insertError) {
                    setSubTasks([...subTasks, inserted[0]]);
                } else {
                    console.error("Erreur insertion IA sous-tâche:", insertError);
                }
            } else {
               alert("Impossible de comprendre la tâche. L'IA n'a pas pu extraire de titre.");
            }
        } catch (err: any) {
            console.error("Erreur de transcription IA:", err);
            alert("La création de la sous-tâche a échoué: " + (err.message || "Erreur réseau"));
        } finally {
            setIsSubtaskTranscribing(false);
        }
    };

    const toggleSubTask = async (subTaskId: string, currentStatut: string, assigneA?: string | null) => {
        // Admin can toggle any subtask. Members can only toggle their own assigned subtasks.
        if (!isAdmin && assigneA !== user.id) return;

        // Members cannot uncheck a completed subtask — only admins can
        if (!isAdmin && currentStatut === 'terminee') return;

        const newStatut = currentStatut === 'terminee' ? 'en_attente' : 'terminee';

        const { error } = await supabase
            .from('sous_taches')
            .update({ statut: newStatut })
            .eq('id', subTaskId);

        if (!error) {
            const updatedSubTasks = subTasks.map(st =>
                st.id === subTaskId ? { ...st, statut: newStatut } : st
            );
            setSubTasks(updatedSubTasks);

            if (newStatut === 'terminee') {
                const completedSub = subTasks.find(st => st.id === subTaskId);
                supabase.from('flux_activite').insert({
                    tache_id: task.id,
                    utilisateur_id: user.id,
                    action: 'Sous-tâche terminée',
                    details: { titre_sous_tache: completedSub?.titre }
                }).then(); // fire and forget
            }

            // Confetti for admins: when ALL subtasks of an important task are done
            if (task.est_important && newStatut === 'terminee') {
                const total = updatedSubTasks.length;
                const completed = updatedSubTasks.filter(st => st.statut === 'terminee').length;
                if (total > 0 && total === completed) {
                    triggerConfetti();
                }
            }

            // Confetti for members: when they finish ALL their own assigned subtasks 🎉
            if (!isAdmin && newStatut === 'terminee') {
                const myTasks = updatedSubTasks.filter(st => st.assigne_a === user.id);
                const myCompleted = myTasks.filter(st => st.statut === 'terminee').length;
                if (myTasks.length > 0 && myTasks.length === myCompleted) {
                    triggerConfetti();
                }
            }
        }
    };

    const triggerConfetti = () => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
                return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
        }, 250);
    };

    const deleteSubTask = async (subTaskId: string) => {
        if (!isAdmin) return;
        const { error } = await supabase
            .from('sous_taches')
            .delete()
            .eq('id', subTaskId);

        if (!error) {
            setSubTasks(subTasks.filter(st => st.id !== subTaskId));
        }
    };

    const assignSubTask = async (subTaskId: string, memberId: string | null) => {
        const { error } = await supabase
            .from('sous_taches')
            .update({ assigne_a: memberId })
            .eq('id', subTaskId);

        if (!error) {
            fetchSubTasks();
        }
        setAssignMenuOpen(null);
    };

    const updateSubTaskDates = async (subTaskId: string, field: 'date_debut' | 'date_fin', value: string) => {
        const { error } = await supabase
            .from('sous_taches')
            .update({ [field]: value ? new Date(value).toISOString() : null })
            .eq('id', subTaskId);

        if (!error) {
            setSubTasks(subTasks.map(st =>
                st.id === subTaskId ? { ...st, [field]: value ? new Date(value).toISOString() : null } : st
            ));
        }
    };

    const generateSubtasks = async () => {
        setIsGenerating(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) return;

            const { data, error } = await supabase.functions.invoke('generate-subtasks', {
                body: { tache_id: task.id, titre: task.titre, description: task.description, date_echeance: task.date_echeance },
                headers: { Authorization: `Bearer ${token}` }
            });

            if (data && !error) {
                fetchSubTasks();
            } else {
                console.error("AI Error:", error);
            }
        } catch (e) {
            console.error("Generate error", e);
        }
        setIsGenerating(false);
    };

    const handleAnalyzeTask = async () => {
        setIsAiPopupOpen(true);
        setIsAiAnalyzing(true);
        setAiAnalysisText(null);
        try {
            // Explicitly get the current session to ensure we have a valid JWT
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) {
                setAiAnalysisText("Session expirée. Veuillez vous reconnecter.");
                return;
            }

            const { data, error } = await supabase.functions.invoke('analyser-tache', {
                body: { tache_id: task.id },
                headers: { Authorization: `Bearer ${token}` }
            });

            if (error) throw error;
            if (data && data.analyse) {
                // data.analyse is a structured object {resume, sante, points_positifs, risques, ...}
                setAiAnalysisText(data.analyse);
            } else {
                setAiAnalysisText("L'analyse n'a pas pu être générée. Veuillez réessayer.");
            }
        } catch (error) {
            console.error("Error analyzing task:", error);
            setAiAnalysisText("Impossible de joindre le Scrum Master IA pour le moment.");
        }
        setIsAiAnalyzing(false);
    };

    // Calculate progress based on subtasks
    const completedCount = subTasks.filter(st => st.statut === 'terminee').length;
    const totalCount = subTasks.length;
    const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Helper for formatting due date
    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    };

    // Determine if the current user is an admin for this task
    let isAdmin = true; // Default to true for personal tasks
    const isCreator = task.createur_id === user.id;

    if (task.est_collectif) {
        isAdmin = isCreator;
        if (!isAdmin) {
            const currentMember = members.find(m => m.utilisateur_id === user.id);
            if (currentMember && currentMember.role === 'admin') {
                isAdmin = true;
            }
        }
    }

    const handleDeleteTask = async () => {
        if (!isAdmin) return;

        const confirmDelete = window.confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?");
        if (!confirmDelete) return;

        // If collective, log the deletion for notifications BEFORE changing status
        if (task.est_collectif) {
            await supabase.from('flux_activite').insert({
                tache_id: task.id,
                utilisateur_id: user.id,
                action: 'Suppression',
                details: {}
            });
        }

        const { error } = await supabase
            .from('taches')
            .update({ statut: 'supprimee' })
            .eq('id', task.id);

        if (!error) {
            onNavigate(task.est_collectif ? 'collective' : 'dashboard');
        } else {
            console.error("Erreur lors de la suppression", error);
        }
    };

    // --- EDIT FUNCTIONS ---
    const openEditTask = () => {
        setEditTarget('task');
        setEditTargetId(currentTask.id);
        setEditTitle(currentTask.titre || '');
        setEditDescription(currentTask.description || '');
        setIsEditModalOpen(true);
    };

    const openEditSubtask = (st: any) => {
        setEditTarget('subtask');
        setEditTargetId(st.id);
        setEditTitle(st.titre || '');
        setEditDescription(st.description || '');
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editTitle.trim()) return;
        setEditSaving(true);

        if (editTarget === 'task') {
            const { error } = await supabase
                .from('taches')
                .update({ titre: editTitle.trim(), description: editDescription.trim() })
                .eq('id', editTargetId);

            if (!error) {
                setCurrentTask({ ...currentTask, titre: editTitle.trim(), description: editDescription.trim() });
            }
        } else {
            const { error } = await supabase
                .from('sous_taches')
                .update({ titre: editTitle.trim() })
                .eq('id', editTargetId);

            if (!error) {
                setSubTasks(subTasks.map(st =>
                    st.id === editTargetId ? { ...st, titre: editTitle.trim() } : st
                ));
            }
        }

        setEditSaving(false);
        setIsEditModalOpen(false);
    };

    if (!task) return null;

    return (
        <div className="task-details-container">
            <div className="bg-blur-top"></div>
            <div className="bg-blur-bottom"></div>

            <AiTaskAnalysisPopup
                isOpen={isAiPopupOpen}
                onClose={() => setIsAiPopupOpen(false)}
                onRegenerate={handleAnalyzeTask}
                analysisText={aiAnalysisText}
                loading={isAiAnalyzing}
            />

            {isInviteModalOpen && (
                <InviteMemberModal
                    taskId={task.id}
                    onClose={() => setIsInviteModalOpen(false)}
                    onInviteSuccess={() => {
                        fetchSubTasks();
                    }}
                />
            )}

            <div className="td-content-wrapper pb-[120px]">
                {/* Header */}
                <header className="td-header">
                    <button className="td-icon-btn" onClick={() => onNavigate('back')}>
                        <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 'bold' }}>Détails</h1>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {task.est_collectif && isAdmin && (
                            <button
                                onClick={() => setIsInviteModalOpen(true)}
                                className="td-icon-btn"
                                style={{ color: 'var(--color-primary)', background: 'rgba(0, 166, 81, 0.1)' }}
                                title="Inviter un membre"
                            >
                                <span className="material-symbols-outlined">person_add</span>
                            </button>
                        )}
                        {isAdmin && (
                            <button
                                onClick={handleDeleteTask}
                                className="td-icon-btn"
                                style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)' }}
                                title="Supprimer la tâche"
                            >
                                <span className="material-symbols-outlined">delete</span>
                            </button>
                        )}
                        <button className="td-icon-btn" style={{ color: 'var(--color-primary)' }}>
                            <span className="material-symbols-outlined">more_horiz</span>
                        </button>
                    </div>
                </header>

                {/* Edit Modal */}
                {isEditModalOpen && (
                    <div className="edit-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                        <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="edit-modal-header">
                                <h3>{editTarget === 'task' ? 'Modifier la tâche' : 'Modifier la sous-tâche'}</h3>
                                <button className="td-icon-btn" onClick={() => setIsEditModalOpen(false)}>
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>
                            <div className="edit-modal-body">
                                <label className="edit-label">Titre</label>
                                <input
                                    className="edit-input"
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Titre..."
                                    autoFocus
                                />
                                {editTarget === 'task' && (
                                    <>
                                        <label className="edit-label">Description</label>
                                        <textarea
                                            className="edit-textarea"
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            placeholder="Description..."
                                            rows={4}
                                        />
                                    </>
                                )}
                            </div>
                            <div className="edit-modal-footer">
                                <button className="edit-cancel-btn" onClick={() => setIsEditModalOpen(false)}>Annuler</button>
                                <button className="edit-save-btn" onClick={handleSaveEdit} disabled={editSaving}>
                                    {editSaving ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Main Task Card */}
                <main className="td-main-box mb-6">
                    <section className="td-card">
                        <div className="td-card-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {currentTask.icone_url ? (
                                    currentTask.icone_url.startsWith('http') ? (
                                        <img src={currentTask.icone_url} alt="Icon" style={{ width: '2rem', height: '2rem', borderRadius: '50%' }} />
                                    ) : (
                                        <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>{currentTask.icone_url}</span>
                                        </div>
                                    )
                                ) : (
                                    <span className="td-priority-badge">Tâche</span>
                                )}
                                {isAdmin && (
                                    <button className="td-edit-pencil" onClick={openEditTask} title="Modifier la tâche">
                                        <span className="material-symbols-outlined">edit</span>
                                    </button>
                                )}
                            </div>
                            <span className="td-due-date">{currentTask.date_echeance ? `Fin: ${formatDate(currentTask.date_echeance)}` : ''}</span>
                        </div>
                        <h2 className="td-title">{currentTask.titre}</h2>
                        <p className="td-desc">{currentTask.description || "Aucune description fournie."}</p>

                        <div className="td-progress-section">
                            <div className="td-progress-text">
                                <span style={{ color: '#cbd5e1' }}>Progression globale</span>
                                <span style={{ color: 'var(--color-primary)' }}>{progressPercent}%</span>
                            </div>
                            <div className="td-progress-bg">
                                <div className="td-progress-fill" style={{ width: `${progressPercent}%` }}></div>
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="mt-4 flex justify-end">
                                <button
                                    onClick={handleAnalyzeTask}
                                    className="px-4 py-2 bg-[#00a651]/20 text-[#34d399] border border-[#00a651]/40 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold hover:bg-[#00a651]/30 transition-all shadow-[0_4px_15px_rgba(0, 166, 81,0.2)]"
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                                    </svg> Analyse IA
                                </button>
                            </div>
                        )}
                    </section>
                </main>

                {/* Tabs for Subtasks / Logs */}
                <div className="flex border-b border-white/10 mb-4 px-2">
                    <button
                        className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'subtasks' ? 'border-[#00a651] text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
                        onClick={() => setActiveTab('subtasks')}
                    >
                        Sous-tâches
                    </button>
                    <button
                        className={`flex-1 pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'logs' ? 'border-[#00a651] text-white' : 'border-transparent text-white/40 hover:text-white/70'}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        Journal (Logs)
                    </button>
                </div>

                {/* Tab Content */}
                <div className="tab-content relative">
                    {activeTab === 'subtasks' && (
                        <section className="td-subtasks-section">
                            <div className="td-subtasks-header mb-4">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <h3 className="td-subtasks-title">{isAdmin ? 'Gérer les Sous-tâches' : 'Sous-tâches'}</h3>
                                    <span className="td-subtasks-count">{completedCount}/{totalCount} Terminées</span>
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={generateSubtasks}
                                        disabled={isGenerating}
                                        style={{
                                            background: 'rgba(0, 166, 81, 0.2)', color: 'var(--color-primary)',
                                            border: '1px solid rgba(0, 166, 81, 0.3)', padding: '0.25rem 0.5rem',
                                            borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer'
                                        }}
                                    >
                                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>auto_awesome</span>
                                        {isGenerating ? 'Génération...' : 'IA Découpage'}
                                    </button>
                                )}
                            </div>

                            {loading ? (
                                <p style={{ textAlign: 'center', color: '#94a3b8' }}>Chargement...</p>
                            ) : (
                                <div className="td-subtasks-list">
                                    {subTasks.map(st => {
                                        const isCompleted = st.statut === 'terminee';

                                        let hasDates = false;
                                        let progressPct = 0;
                                        let timeStatus: 'normal' | 'warning' | 'overdue' = 'normal';

                                        if (st.date_debut && st.date_fin) {
                                            hasDates = true;
                                            const now = new Date().getTime();
                                            const start = new Date(st.date_debut).getTime();
                                            const end = new Date(st.date_fin).getTime() + 86400000;

                                            if (end > start) {
                                                const total = end - start;
                                                const elapsed = now - start;
                                                progressPct = (elapsed / total) * 100;
                                                progressPct = Math.max(0, Math.min(100, progressPct));

                                                if (now > end) {
                                                    timeStatus = 'overdue';
                                                    progressPct = 100;
                                                } else if (progressPct >= 80) {
                                                    timeStatus = 'warning';
                                                }
                                            } else if (now > end) {
                                                timeStatus = 'overdue';
                                                progressPct = 100;
                                            }
                                        }

                                        return (
                                            <div
                                                key={st.id}
                                                className={`td-subtask-item ${isCompleted ? 'completed' : ''}`}
                                                style={{ zIndex: assignMenuOpen === st.id ? 50 : 1, display: 'flex', alignItems: 'flex-start', padding: '0.75rem 1rem' }}
                                            >
                                                <div
                                                    className={`td-checkbox ${isCompleted ? 'completed' : 'active'}`}
                                                    onClick={() => toggleSubTask(st.id, st.statut, st.assigne_a)}
                                                    style={{
                                                        marginTop: '2px',
                                                        cursor: isAdmin
                                                            ? 'pointer'
                                                            : (st.assigne_a === user.id && !isCompleted)
                                                                ? 'pointer'
                                                                : 'default',
                                                        opacity: isAdmin
                                                            ? 1
                                                            : (st.assigne_a === user.id)
                                                                ? (isCompleted ? 0.7 : 1)
                                                                : 0.4
                                                    }}
                                                >
                                                    {isCompleted && <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '16px' }}>check</span>}
                                                </div>

                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                        <span className={`td-subtask-text ${isCompleted ? 'completed' : ''}`} style={{ lineHeight: '1.4' }}>
                                                            {st.titre}
                                                        </span>
                                                        {isAdmin && (
                                                            <button className="td-edit-pencil sm" onClick={() => openEditSubtask(st)} title="Modifier la sous-tâche">
                                                                <span className="material-symbols-outlined">edit</span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {task.est_collectif && hasDates && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%', maxWidth: '250px', marginTop: '0.25rem', opacity: isCompleted ? 0.6 : 1 }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600 }}>
                                                                <span>Progression temps</span>
                                                                {timeStatus === 'overdue' && !isCompleted && (
                                                                    <span style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>warning</span> Délai dépassé
                                                                    </span>
                                                                )}
                                                                {timeStatus === 'warning' && !isCompleted && (
                                                                    <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                        <span className="material-symbols-outlined" style={{ fontSize: '11px' }}>schedule</span> Échéance proche
                                                                    </span>
                                                                )}
                                                                {timeStatus === 'normal' && !isCompleted && (
                                                                    <span>{Math.round(progressPct)}%</span>
                                                                )}
                                                                {isCompleted && <span>Terminée</span>}
                                                            </div>
                                                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', overflow: 'hidden' }}>
                                                                <div style={{
                                                                    height: '100%',
                                                                    width: `${progressPct}%`,
                                                                    background: isCompleted ? '#22c55e' : (timeStatus === 'overdue' ? '#ef4444' : timeStatus === 'warning' ? '#f59e0b' : '#a855f7'),
                                                                    borderRadius: '9999px',
                                                                    transition: 'width 0.3s ease, background 0.3s ease'
                                                                }} />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {task.est_collectif && (
                                                        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center', opacity: isCompleted ? 0.5 : 1, transition: 'opacity 0.2s', marginTop: '0.25rem' }}>
                                                            {/* Start date */}
                                                            <label className="td-date-badge" style={{ position: 'relative' }}>
                                                                <span className="material-symbols-outlined">flight_takeoff</span>
                                                                <span style={{ fontSize: '11px', fontWeight: 500, minWidth: '30px' }}>
                                                                    {st.date_debut ? new Date(st.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : (isAdmin ? '+' : '—')}
                                                                </span>
                                                                {isAdmin && (
                                                                    <input
                                                                        type="date"
                                                                        defaultValue={st.date_debut ? new Date(st.date_debut).toISOString().slice(0, 10) : ''}
                                                                        onChange={(e) => updateSubTaskDates(st.id, 'date_debut', e.target.value)}
                                                                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', colorScheme: 'dark' }}
                                                                        title="Date de début"
                                                                    />
                                                                )}
                                                            </label>

                                                            <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem', flexShrink: 0 }}>→</span>

                                                            {/* End date */}
                                                            <label className={`td-date-badge ${st.date_fin && !isCompleted && new Date(st.date_fin) < new Date() ? 'overdue' : ''}`} style={{ position: 'relative' }}>
                                                                <span className="material-symbols-outlined">flight_land</span>
                                                                <span style={{ fontSize: '11px', fontWeight: 500, minWidth: '30px' }}>
                                                                    {st.date_fin ? new Date(st.date_fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : (isAdmin ? '+' : '—')}
                                                                </span>
                                                                {isAdmin && (
                                                                    <input
                                                                        type="date"
                                                                        defaultValue={st.date_fin ? new Date(st.date_fin).toISOString().slice(0, 10) : ''}
                                                                        onChange={(e) => updateSubTaskDates(st.id, 'date_fin', e.target.value)}
                                                                        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', colorScheme: 'dark' }}
                                                                        title="Date limite"
                                                                    />
                                                                )}
                                                            </label>

                                                            {/* Overdue alert */}
                                                            {st.date_fin && !isCompleted && new Date(st.date_fin) < new Date() && (
                                                                <span className="td-overdue-alert">
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>warning</span>
                                                                    En retard
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '2px' }}>
                                                    {task.est_collectif && (isAdmin || st.assigne_a === user.id) && (
                                                        <div style={{ position: 'relative' }}>
                                                            {st.assigne_a ? (
                                                                <img
                                                                    src={st.profils?.avatar_url || "https://ui-avatars.com/api/?name=" + (st.profils?.nom || 'User')}
                                                                    title={st.profils?.nom}
                                                                    style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', cursor: isAdmin ? 'pointer' : 'default', border: '2px solid rgba(255,255,255,0.1)', objectFit: 'cover' }}
                                                                    onClick={() => isAdmin && setAssignMenuOpen(assignMenuOpen === st.id ? null : st.id)}
                                                                />
                                                            ) : (
                                                                <button
                                                                    onClick={() => isAdmin && setAssignMenuOpen(assignMenuOpen === st.id ? null : st.id)}
                                                                    style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', border: '1px dashed rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', cursor: isAdmin ? 'pointer' : 'default', transition: 'all 0.2s' }}
                                                                    className="td-assign-btn"
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>person_add</span>
                                                                </button>
                                                            )}

                                                            {assignMenuOpen === st.id && isAdmin && (
                                                                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', borderTop: '1px solid rgba(0, 166, 81, 0.5)', borderRadius: '0.75rem', padding: '0.5rem', zIndex: 100, minWidth: '180px', maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.8)' }}>
                                                                    <p style={{ margin: 0, padding: '0.25rem 0.5rem 0.5rem', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '0.25rem' }}>Assigner à</p>
                                                                    <button
                                                                        onClick={() => assignSubTask(st.id, null)}
                                                                        style={{ width: '100%', textAlign: 'left', padding: '0.5rem', fontSize: '0.875rem', color: '#f8fafc', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background 0.2s' }}
                                                                        className="td-dropdown-item"
                                                                    >
                                                                        Non assigné
                                                                    </button>
                                                                    <button
                                                                        onClick={() => assignSubTask(st.id, user.id)}
                                                                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', fontSize: '0.875rem', color: '#f8fafc', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background 0.2s' }}
                                                                        className="td-dropdown-item"
                                                                    >
                                                                        <img src={user.user_metadata?.avatar_url || "https://ui-avatars.com/api/?name=" + (user.user_metadata?.full_name || 'U')} style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', objectFit: 'cover' }} />
                                                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Moi ({user.user_metadata?.full_name || 'Créateur'})</span>
                                                                    </button>
                                                                    {members.map(m => (
                                                                        <button
                                                                            key={m.utilisateur_id}
                                                                            onClick={() => assignSubTask(st.id, m.utilisateur_id)}
                                                                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', fontSize: '0.875rem', color: '#f8fafc', background: 'transparent', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', transition: 'background 0.2s' }}
                                                                            className="td-dropdown-item"
                                                                        >
                                                                            <img src={m.profils?.avatar_url || "https://ui-avatars.com/api/?name=" + (m.profils?.nom || 'User')} style={{ width: '1.5rem', height: '1.5rem', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', objectFit: 'cover' }} />
                                                                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.profils?.nom || 'Membre'}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {isAdmin && (
                                                        <button className="td-delete-btn" title="Supprimer la sous-tâche" onClick={() => deleteSubTask(st.id)}>
                                                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>delete_outline</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {subTasks.length === 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1rem' }}>
                                            <div style={{ width: '100%', maxWidth: '280px', aspectRatio: '1/1', opacity: 0.9, marginBottom: '1.5rem' }}>
                                                <DotLottieReact
                                                    src="https://lottie.host/020e5ef9-b972-44ca-a47f-166c34509e77/6gf3MEjI9P.lottie"
                                                    loop
                                                    autoplay
                                                />
                                            </div>
                                            <h4 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', textAlign: 'center' }}>
                                                Aucune sous-tâche
                                            </h4>
                                            <p style={{ marginTop: '0.5rem', marginBottom: 0, fontSize: '0.9rem', color: '#94a3b8', textAlign: 'center', maxWidth: '300px' }}>
                                                Découpez cette tâche en éléments plus simples pour avancer plus vite !
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                    {activeTab === 'logs' && (
                        <LogSection logs={logs} currentUserId={user.id} />
                    )}
                </div>

                {/* Bottom Input Dock */}
                {!(activeTab === 'subtasks' && !isCreator) && (
                    <div className="td-bottom-area">
                        <form className="td-input-wrapper" style={{ maxWidth: '800px' }} onSubmit={handleAddItem}>

                            {activeTab === 'logs' && (
                                <div className="td-log-type-group">
                                    <button
                                        type="button"
                                        className={`td-log-type-pill ${logType === 'fait' ? 'active' : ''}`}
                                        data-type="fait"
                                        onClick={() => setLogType('fait')}
                                    >
                                        Fait
                                    </button>
                                    <button
                                        type="button"
                                        className={`td-log-type-pill ${logType === 'probleme' ? 'active' : ''}`}
                                        data-type="probleme"
                                        onClick={() => setLogType('probleme')}
                                    >
                                        Problème
                                    </button>
                                    <button
                                        type="button"
                                        className={`td-log-type-pill ${logType === 'prevu' ? 'active' : ''}`}
                                        data-type="prevu"
                                        onClick={() => setLogType('prevu')}
                                    >
                                        Prévu
                                    </button>
                                </div>
                            )}

                            <div className="td-input-row" style={{ position: 'relative' }}>
                                {(isRecording || isTranscribing || isSubtaskRecording || isSubtaskTranscribing) && (
                                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', padding: '0 1rem', borderRadius: 'inherit', zIndex: 10, gap: '1rem', color: (isRecording || isSubtaskRecording) ? '#ef4444' : (isSubtaskTranscribing ? '#a855f7' : '#34d399') }}>
                                        <span className="material-symbols-outlined" style={{ animation: (isRecording || isSubtaskRecording) ? 'pulse 1.5s infinite' : 'spin 1s linear infinite' }}>
                                            {(isRecording || isSubtaskRecording) ? 'radio_button_checked' : (isSubtaskTranscribing ? 'auto_awesome' : 'autorenew')}
                                        </span>
                                        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                                            {(isRecording || isSubtaskRecording) ? 'Enregistrement en cours...' : (isSubtaskTranscribing ? 'Analyse de la voix par l\'IA...' : 'Transcription en cours...')}
                                        </span>
                                        {(isRecording || isSubtaskRecording) && (
                                            <button type="button" onClick={isRecording ? stopRecording : stopSubtaskRecording} style={{ marginLeft: 'auto', background: '#ef4444', color: 'white', border: 'none', borderRadius: '99px', padding: '0.25rem 0.75rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                                                {isSubtaskRecording ? 'Analyser' : 'Transcrire'}
                                            </button>
                                        )}
                                    </div>
                                )}
                                <input
                                    className="td-input"
                                    type="text"
                                    placeholder={activeTab === 'subtasks' ? "Ajouter une sous-tâche..." : "Décrire votre avancement ou blocage..."}
                                    value={newItemText}
                                    onChange={(e) => setNewItemText(e.target.value)}
                                    disabled={isRecording || isTranscribing || isSubtaskRecording || isSubtaskTranscribing}
                                />
                                {activeTab === 'subtasks' && isAdmin && (
                                    <button 
                                        type="button" 
                                        onClick={startSubtaskRecording}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', transition: 'all 0.2s' }}
                                        title="Créer une sous-tâche par la voix (IA)"
                                    >
                                        <span className="material-symbols-outlined">auto_awesome</span>
                                    </button>
                                )}
                                {activeTab === 'logs' && (
                                    <button 
                                        type="button" 
                                        onClick={startRecording}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '0.5rem', borderRadius: '50%', transition: 'all 0.2s' }}
                                        title="Dicter un log vocalement"
                                    >
                                        <span className="material-symbols-outlined">mic</span>
                                    </button>
                                )}
                                <button type="submit" className="td-add-btn" disabled={isRecording || isTranscribing || isSubtaskRecording || isSubtaskTranscribing}>
                                    {activeTab === 'subtasks' ? (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                    ) : (
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
