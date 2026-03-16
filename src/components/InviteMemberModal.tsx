import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';


interface InviteMemberModalProps {
    taskId: string;
    onClose: () => void;
    onInviteSuccess: () => void;
}

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({ taskId, onClose, onInviteSuccess }) => {
    const [searchEmail, setSearchEmail] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<any | null>(null);
    const [searchError, setSearchError] = useState('');
    const [inviting, setInviting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [contacts, setContacts] = useState<any[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [activeTab, setActiveTab] = useState<'contacts' | 'email'>('contacts');

    useEffect(() => {
        fetchAcceptedContacts();
    }, []);

    const fetchAcceptedContacts = async () => {
        setLoadingContacts(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch contacts where the user is the owner AND contact accepted
        const { data } = await supabase
            .from('contacts_permanents')
            .select('*, profils!contacts_permanents_contact_id_fkey(id, nom, avatar_url, email)')
            .eq('proprietaire_id', user.id)
            .eq('statut', 'accepte');

        if (data) {
            // Filter out contacts already in this task
            const { data: existingMembers } = await supabase
                .from('membres_tache')
                .select('utilisateur_id')
                .eq('tache_id', taskId);

            const memberIds = new Set(existingMembers?.map(m => m.utilisateur_id) || []);
            setContacts(data.filter(c => !memberIds.has(c.contact_id)));
        }
        setLoadingContacts(false);
    };

    const handleInviteContact = async (contactId: string) => {
        setInviting(true);
        try {
            const { error } = await supabase
                .from('membres_tache')
                .insert({
                    tache_id: taskId,
                    utilisateur_id: contactId,
                    role: 'membre',
                    statut: 'en_attente'
                });

            if (error) throw error;

            setSuccessMessage("Invitation envoyée !");
            setContacts(prev => prev.filter(c => c.contact_id !== contactId));
            onInviteSuccess();
            setTimeout(() => setSuccessMessage(''), 2000);
        } catch (error: any) {
            setSearchError(error.message || "Erreur lors de l'envoi.");
            setTimeout(() => setSearchError(''), 3000);
        } finally {
            setInviting(false);
        }
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchEmail.trim()) return;

        setSearching(true);
        setSearchError('');
        setSearchResult(null);
        setSuccessMessage('');

        try {
            const { data, error } = await supabase
                .rpc('search_user_by_email', { search_email: searchEmail.toLowerCase().trim() });

            if (error || !data || data.length === 0) {
                setSearchError("Aucun utilisateur trouvé avec cette adresse e-mail.");
                return;
            }

            const foundUser = data[0];
            const { data: existingMember } = await supabase
                .from('membres_tache')
                .select('statut')
                .eq('tache_id', taskId)
                .eq('utilisateur_id', foundUser.id)
                .maybeSingle();

            if (existingMember) {
                if (existingMember.statut === 'accepte') {
                    setSearchError("Cet utilisateur est déjà membre de la tâche.");
                } else if (existingMember.statut === 'en_attente') {
                    setSearchError("Une invitation est déjà en attente.");
                } else {
                    setSearchError("Cet utilisateur a refusé l'invitation.");
                }
                return;
            }

            setSearchResult(foundUser);
        } catch (error) {
            console.error('Error searching user:', error);
            setSearchError("Erreur lors de la recherche.");
        } finally {
            setSearching(false);
        }
    };

    const handleInvite = async () => {
        if (!searchResult) return;

        setInviting(true);
        try {
            const { error } = await supabase
                .from('membres_tache')
                .insert({
                    tache_id: taskId,
                    utilisateur_id: searchResult.id,
                    role: 'membre',
                    statut: 'en_attente'
                });

            if (error) throw error;

            setSuccessMessage("Invitation envoyée avec succès !");
            setSearchResult(null);
            setSearchEmail('');
            onInviteSuccess();
            setTimeout(() => { onClose(); }, 2000);

        } catch (error: any) {
            console.error('Error inviting user:', error);
            setSearchError(error.message || "Erreur lors de l'envoi de l'invitation.");
        } finally {
            setInviting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end p-0 font-['Manrope'] text-slate-100">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose}></div>

            {/* Bottom Sheet Container */}
            <div
                className="relative w-full mx-auto rounded-t-[2.5rem] flex flex-col animate-in slide-in-from-bottom duration-300 pb-10 shadow-2xl"
                style={{
                    background: 'rgba(43, 27, 61, 0.4)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    border: '1px solid rgba(0, 166, 81, 0.2)',
                    borderBottom: 'none',
                    maxHeight: '80vh'
                }}
            >
                {/* Handle */}
                <div className="flex h-8 w-full items-center justify-center">
                    <div className="h-1.5 w-12 rounded-full bg-[#00a651]/30"></div>
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 pb-4">
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-100">Inviter un membre</h2>
                    <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined text-slate-400 text-[22px]">close</span>
                    </button>
                </div>

                {/* Tab Switcher */}
                <div className="px-6 pb-4">
                    <div style={{
                        display: 'flex',
                        gap: '0.25rem',
                        background: 'rgba(255,255,255,0.03)',
                        borderRadius: '0.75rem',
                        padding: '0.25rem',
                        border: '1px solid rgba(255,255,255,0.04)'
                    }}>
                        <button
                            onClick={() => setActiveTab('contacts')}
                            style={{
                                flex: 1,
                                padding: '0.6rem 0',
                                borderRadius: '0.5rem',
                                border: 'none',
                                fontFamily: 'inherit',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                background: activeTab === 'contacts' ? 'rgba(0,166,81,0.15)' : 'transparent',
                                color: activeTab === 'contacts' ? '#4ade80' : 'rgba(255,255,255,0.4)',
                                ...(activeTab === 'contacts' ? { border: '1px solid rgba(0,166,81,0.2)' } : {})
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>group</span>
                            Mes Contacts
                        </button>
                        <button
                            onClick={() => setActiveTab('email')}
                            style={{
                                flex: 1,
                                padding: '0.6rem 0',
                                borderRadius: '0.5rem',
                                border: 'none',
                                fontFamily: 'inherit',
                                fontWeight: 700,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.4rem',
                                background: activeTab === 'email' ? 'rgba(96,165,250,0.15)' : 'transparent',
                                color: activeTab === 'email' ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                                ...(activeTab === 'email' ? { border: '1px solid rgba(96,165,250,0.2)' } : {})
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>mail</span>
                            Par Email
                        </button>
                    </div>
                </div>

                {/* Messages */}
                {searchError && (
                    <p className="px-6 text-red-400 text-sm text-center mb-2">{searchError}</p>
                )}
                {successMessage && (
                    <p className="px-6 text-green-400 font-bold text-sm text-center mb-2">{successMessage}</p>
                )}

                {/* TAB: Contacts permanents */}
                {activeTab === 'contacts' && (
                    <div className="px-6 overflow-y-auto" style={{ maxHeight: '40vh', scrollbarWidth: 'none' }}>
                        {loadingContacts ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '2rem', animation: 'spin 1s linear infinite' }}>progress_activity</span>
                            </div>
                        ) : contacts.length === 0 ? (
                            <div style={{
                                textAlign: 'center',
                                padding: '2rem 1rem',
                                color: '#64748b',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.75rem'
                            }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', opacity: 0.4 }}>person_off</span>
                                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                                    Aucun contact permanent disponible.
                                </p>
                                <p style={{ margin: 0, fontSize: '0.75rem', color: '#475569' }}>
                                    Ajoutez des contacts depuis votre page Profile → Contacts
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingBottom: '1rem' }}>
                                {contacts.map(contact => {
                                    const profile = contact.profils;
                                    const name = profile?.nom || profile?.email || 'Utilisateur';
                                    const avatarUrl = profile?.avatar_url || `https://ui-avatars.com/api/?name=${name}&background=8c2bee&color=fff`;

                                    return (
                                        <div key={contact.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.75rem',
                                            padding: '0.75rem',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '0.75rem',
                                            border: '1px solid rgba(255,255,255,0.06)'
                                        }}>
                                            <img src={avatarUrl} alt={name} style={{
                                                width: '2.75rem',
                                                height: '2.75rem',
                                                borderRadius: '50%',
                                                border: '2px solid rgba(0,166,81,0.3)',
                                                objectFit: 'cover'
                                            }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>{name}</p>
                                                <p style={{ margin: 0, fontSize: '0.7rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email || ''}</p>
                                            </div>
                                            <button
                                                onClick={() => handleInviteContact(contact.contact_id)}
                                                disabled={inviting}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    background: 'linear-gradient(135deg, #00a651, #047857)',
                                                    border: 'none',
                                                    borderRadius: '0.5rem',
                                                    color: '#fff',
                                                    fontWeight: 700,
                                                    fontSize: '0.75rem',
                                                    cursor: 'pointer',
                                                    fontFamily: 'inherit',
                                                    boxShadow: '0 4px 12px rgba(0,166,81,0.3)',
                                                    transition: 'all 0.2s',
                                                    flexShrink: 0,
                                                    opacity: inviting ? 0.5 : 1
                                                }}
                                            >
                                                Inviter
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Search by email */}
                {activeTab === 'email' && (
                    <>
                        <form onSubmit={handleSearch} className="px-6 py-4">
                            <label className="block mb-2 text-sm font-semibold text-slate-400 ml-1">Email de l'utilisateur</label>
                            <div className="relative group">
                                <input
                                    className="w-full h-14 pl-12 pr-24 rounded-xl border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00a651] focus:border-transparent transition-all"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        backdropFilter: 'blur(10px)',
                                    }}
                                    placeholder="Entrez l'email..."
                                    type="email"
                                    value={searchEmail}
                                    onChange={(e) => setSearchEmail(e.target.value)}
                                    required
                                />
                                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#00a651] transition-colors">search</span>

                                <button
                                    type="submit"
                                    disabled={searching || !searchEmail}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-[#00a651] hover:bg-[#00a651]/90 disabled:bg-white/10 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all"
                                >
                                    {searching ? '...' : 'Chercher'}
                                </button>
                            </div>
                        </form>

                        {/* Results Section (Found User) */}
                        {searchResult && !successMessage && (
                            <div className="px-6 py-4 animate-in fade-in duration-300">
                                <div
                                    className="border border-white/5 rounded-2xl p-4 flex items-center gap-4"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.03)',
                                        backdropFilter: 'blur(10px)',
                                    }}
                                >
                                    <div className="relative">
                                        <div className="w-14 h-14 rounded-full border-2 border-[#00a651] flex items-center justify-center bg-[#00a651]/20 text-white font-bold text-xl">
                                            {searchResult.email.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-[#191022] rounded-full"></div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-100 text-base leading-none mb-1">{searchResult.email.split('@')[0]}</p>
                                        <p className="text-xs text-slate-400">{searchResult.email}</p>
                                    </div>
                                    <button
                                        onClick={handleInvite}
                                        disabled={inviting}
                                        className="bg-[#00a651] hover:bg-[#00a651]/90 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-[#00a651]/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {inviting ? 'Envoi...' : 'Inviter'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
