import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './ContactsPage.css';

interface ContactsPageProps {
    user: any;
    onNavigate: (page: string) => void;
}

export function ContactsPage({ user, onNavigate }: ContactsPageProps) {
    const [contacts, setContacts] = useState<any[]>([]);
    const [pendingReceived, setPendingReceived] = useState<any[]>([]);
    const [email, setEmail] = useState('');
    const [searching, setSearching] = useState(false);
    const [message, setMessage] = useState('');
    const [msgType, setMsgType] = useState<'success' | 'error'>('success');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchContacts();
        fetchPendingReceived();

        const channel = supabase.channel('contacts-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts_permanents' }, () => {
                fetchContacts();
                fetchPendingReceived();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchContacts = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('contacts_permanents')
            .select('*, profils!contacts_permanents_contact_id_fkey(id, nom, avatar_url, email)')
            .eq('proprietaire_id', user.id)
            .eq('statut', 'accepte');

        if (data) setContacts(data);
        setLoading(false);
    };

    const fetchPendingReceived = async () => {
        // Contact requests received by this user (from others)
        const { data } = await supabase
            .from('contacts_permanents')
            .select('*, profils!contacts_permanents_proprietaire_id_fkey(id, nom, avatar_url, email)')
            .eq('contact_id', user.id)
            .eq('statut', 'en_attente');

        if (data) setPendingReceived(data);
    };

    const showMsg = (text: string, type: 'success' | 'error') => {
        setMessage(text);
        setMsgType(type);
        setTimeout(() => setMessage(''), 3000);
    };

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setSearching(true);
        try {
            // Find user by email
            const { data, error } = await supabase
                .rpc('search_user_by_email', { search_email: email.toLowerCase().trim() });

            if (error || !data || data.length === 0) {
                showMsg("Aucun utilisateur trouvé.", 'error');
                return;
            }

            const foundUser = data[0];

            if (foundUser.id === user.id) {
                showMsg("Vous ne pouvez pas vous ajouter vous-même.", 'error');
                return;
            }

            // Check if already exists
            const { data: existing } = await supabase
                .from('contacts_permanents')
                .select('id, statut')
                .eq('proprietaire_id', user.id)
                .eq('contact_id', foundUser.id)
                .maybeSingle();

            if (existing) {
                if (existing.statut === 'accepte') showMsg("Ce contact existe déjà.", 'error');
                else showMsg("Une demande est déjà en attente.", 'error');
                return;
            }

            // Create contact request
            const { error: insertError } = await supabase
                .from('contacts_permanents')
                .insert({
                    proprietaire_id: user.id,
                    contact_id: foundUser.id,
                    statut: 'en_attente'
                });

            if (insertError) throw insertError;

            showMsg("Demande de contact envoyée !", 'success');
            setEmail('');
        } catch (err: any) {
            showMsg(err.message || "Erreur.", 'error');
        } finally {
            setSearching(false);
        }
    };

    const respondToRequest = async (requestId: string, accept: boolean) => {
        const { error } = await supabase
            .from('contacts_permanents')
            .update({ statut: accept ? 'accepte' : 'refuse' })
            .eq('id', requestId);

        if (!error) {
            showMsg(accept ? 'Contact accepté !' : 'Demande refusée.', accept ? 'success' : 'error');
            fetchPendingReceived();
            if (accept) fetchContacts();
        }
    };

    const removeContact = async (contactId: string) => {
        await supabase
            .from('contacts_permanents')
            .delete()
            .eq('id', contactId);

        setContacts(prev => prev.filter(c => c.id !== contactId));
        showMsg('Contact supprimé.', 'success');
    };

    return (
        <div className="contacts-container">
            <div className="contacts-scroll">
                {/* Header */}
                <header className="contacts-header">
                    <button className="contacts-icon-btn" onClick={() => onNavigate('back')}>
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <h1 className="contacts-page-title">Mes Contacts</h1>
                    <button
                        className="contacts-icon-btn"
                        onClick={() => onNavigate('leaderboard')}
                        title="Classement"
                        style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#f59e0b' }}
                    >
                        <span className="material-symbols-outlined">emoji_events</span>
                    </button>
                </header>

                {/* Add Contact Form */}
                <form onSubmit={handleAddContact} className="contacts-add-form">
                    <label className="contacts-form-label">Ajouter un contact permanent</label>
                    <div className="contacts-input-row">
                        <input
                            className="contacts-input"
                            type="email"
                            placeholder="Email de l'utilisateur..."
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <button className="contacts-add-btn" type="submit" disabled={searching}>
                            <span className="material-symbols-outlined">{searching ? 'hourglass_top' : 'person_add'}</span>
                        </button>
                    </div>
                    {message && (
                        <p className={`contacts-msg ${msgType}`}>{message}</p>
                    )}
                </form>

                {/* Pending Requests Received */}
                {pendingReceived.length > 0 && (
                    <section className="contacts-section">
                        <h2 className="contacts-section-title">
                            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#f59e0b' }}>notifications_active</span>
                            Demandes Reçues ({pendingReceived.length})
                        </h2>
                        <div className="contacts-list">
                            {pendingReceived.map(req => {
                                const p = req.profils;
                                const name = p?.nom || 'Utilisateur';
                                const avatar = p?.avatar_url || `https://ui-avatars.com/api/?name=${name}&background=f59e0b&color=fff`;

                                return (
                                    <div key={req.id} className="contact-card pending">
                                        <img src={avatar} alt={name} className="contact-avatar" />
                                        <div className="contact-info">
                                            <p className="contact-name">{name}</p>
                                            <p className="contact-email">{p?.email || ''}</p>
                                        </div>
                                        <div className="contact-actions">
                                            <button className="contact-accept-btn" onClick={() => respondToRequest(req.id, true)}>
                                                <span className="material-symbols-outlined">check</span>
                                            </button>
                                            <button className="contact-reject-btn" onClick={() => respondToRequest(req.id, false)}>
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* Accepted Contacts */}
                <section className="contacts-section">
                    <h2 className="contacts-section-title">
                        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: '#4ade80' }}>group</span>
                        Contacts Permanents ({contacts.length})
                    </h2>
                    <div className="contacts-list">
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '2rem 0', color: '#64748b' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>progress_activity</span>
                            </div>
                        ) : contacts.length === 0 ? (
                            <div className="contacts-empty">
                                <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.3 }}>person_off</span>
                                <p>Aucun contact permanent</p>
                                <p style={{ fontSize: '0.75rem', color: '#475569' }}>
                                    Ajoutez des contacts avec leur email ci-dessus
                                </p>
                            </div>
                        ) : (
                            contacts.map(contact => {
                                const p = contact.profils;
                                const name = p?.nom || 'Utilisateur';
                                const avatar = p?.avatar_url || `https://ui-avatars.com/api/?name=${name}&background=8c2bee&color=fff`;

                                return (
                                    <div key={contact.id} className="contact-card">
                                        <img src={avatar} alt={name} className="contact-avatar" />
                                        <div className="contact-info">
                                            <p className="contact-name">{name}</p>
                                            <p className="contact-email">{p?.email || ''}</p>
                                        </div>
                                        <button className="contact-remove-btn" onClick={() => removeContact(contact.id)} title="Supprimer">
                                            <span className="material-symbols-outlined">person_remove</span>
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
