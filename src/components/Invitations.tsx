import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';


interface Invitation {
    tache_id: string;
    description: string;
    titre: string;
    statut: string;
    createur_nom: string;
}

export const Invitations: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInvitations();

        // Subscribe to realtime invitation updates
        const channel = supabase.channel('public:membres_tache')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'membres_tache' }, () => {
                fetchInvitations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel).catch(() => { });
        };
    }, []);

    const fetchInvitations = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Fetch tasks where the user is invited and status is 'en_attente'
            const { data, error } = await supabase
                .from('membres_tache')
                .select(`
                    statut,
                    tache_id,
                    taches:tache_id (
                        titre,
                        description,
                        createur_id
                    )
                `)
                .eq('utilisateur_id', user.id)
                .eq('statut', 'en_attente');

            if (error) throw error;

            if (data) {
                // Fetch creators' names
                const formattedInvites = await Promise.all(data.map(async (invite: any) => {
                    const task = invite.taches;
                    if (!task) return null;

                    const { data: creatorData } = await supabase
                        .from('profils')
                        .select('nom')
                        .eq('id', task.createur_id)
                        .single();

                    return {
                        tache_id: invite.tache_id,
                        titre: task.titre,
                        description: task.description,
                        statut: invite.statut,
                        createur_nom: creatorData?.nom || 'Utilisateur inconnu'
                    };
                }));

                setInvitations(formattedInvites.filter(Boolean) as Invitation[]);
            }
        } catch (err: any) {
            console.error('Error fetching invitations:', err);
        } finally {
            setLoading(false);
        }
    };

    const respondToInvitation = async (tacheId: string, accept: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const newStatus = accept ? 'accepte' : 'refuse';

            const { error } = await supabase
                .from('membres_tache')
                .update({ statut: newStatus })
                .eq('tache_id', tacheId)
                .eq('utilisateur_id', user.id);

            if (error) throw error;

            // Update local state to remove the processed invitation
            setInvitations(prev => prev.filter(inv => inv.tache_id !== tacheId));

            // If accepted, could trigger a notification down the line
        } catch (err: any) {
            console.error('Error responding to invitation:', err);
            alert(`Erreur lors de la réponse à l'invitation: ${err.message}`);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#191022] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-white/10 border-t-[#00a651] rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#191022] font-['Manrope'] text-slate-100 flex flex-col items-center justify-center overflow-x-hidden p-0">
            {/* The exact Stitch View wrapped in full height */}
            <div className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#191022]" style={{
                backgroundImage: `
                    radial-gradient(at 0% 0%, rgba(0, 166, 81, 0.15) 0px, transparent 50%),
                    radial-gradient(at 100% 0%, rgba(59, 130, 246, 0.15) 0px, transparent 50%),
                    radial-gradient(at 100% 100%, rgba(0, 166, 81, 0.1) 0px, transparent 50%),
                    radial-gradient(at 0% 100%, rgba(59, 130, 246, 0.1) 0px, transparent 50%)
                `
            }}>
                {/* Header */}
                <header className="sticky top-0 z-20 flex items-center justify-between px-6 pt-12 pb-4" style={{ background: 'rgba(255, 255, 255, 0.03)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <button onClick={() => onNavigate('back')} className="flex items-center justify-center h-10 w-10 rounded-full hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-slate-100">arrow_back_ios_new</span>
                    </button>
                    <h1 className="text-lg font-bold tracking-tight text-slate-100">Invitations en attente</h1>
                    <div className="h-10 w-10"></div> {/* Spacer for symmetry */}
                </header>

                {/* Main Content Scroll Area */}
                <main className="flex-1 overflow-y-auto px-6 pt-6 pb-24 space-y-4">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-[#00a651] mb-4 opacity-80">Tâches Collectives ({invitations.length})</h2>

                    {invitations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                            <div style={{ width: '100%', maxWidth: '280px', aspectRatio: '1/1', opacity: 0.9 }}>
                                <DotLottieReact
                                    src="https://lottie.host/1e2d386d-edf9-4322-b71a-79774f0e53ea/HTYpE8sWUn.lottie"
                                    loop
                                    autoplay
                                />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-bold text-white">Tout est à jour !</h3>
                                <p className="text-slate-400">Aucune invitation en attente pour le moment.</p>
                            </div>
                        </div>
                    ) : (
                        invitations.map((invitation) => (
                            <div key={invitation.tache_id} className="p-5 rounded-xl space-y-5" style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h3 className="text-xl font-bold text-white">{invitation.titre}</h3>
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-6 rounded-full border border-[#00a651]/30 bg-[#00a651]/20 flex items-center justify-center overflow-hidden">
                                                <span className="material-symbols-outlined text-[12px] text-white">person</span>
                                            </div>
                                            <p className="text-slate-300 text-sm font-medium">Invité(e) par <span className="text-white">{invitation.createur_nom}</span></p>
                                        </div>
                                    </div>
                                    <div className="h-12 w-12 rounded-lg bg-[#00a651]/20 flex items-center justify-center">
                                        <span className="material-symbols-outlined text-[#00a651]">group</span>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => respondToInvitation(invitation.tache_id, true)}
                                        className="flex-1 bg-[#00a651] hover:bg-[#00a651]/90 text-white h-12 rounded-lg font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#00a651]/20"
                                    >
                                        <span className="material-symbols-outlined text-xl">check</span>
                                        Accepter
                                    </button>
                                    <button
                                        onClick={() => respondToInvitation(invitation.tache_id, false)}
                                        className="flex-1 hover:bg-white/10 text-white h-12 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                                        style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
                                    >
                                        <span className="material-symbols-outlined text-xl">close</span>
                                        Refuser
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </main>

                {/* Dynamic Background Elements */}
                <div className="absolute top-[-10%] left-[-10%] h-64 w-64 bg-[#00a651]/20 blur-[100px] pointer-events-none z-0"></div>
                <div className="absolute bottom-[20%] right-[-10%] h-64 w-64 bg-blue-500/10 blur-[80px] pointer-events-none z-0"></div>
            </div>
        </div>
    );
};
