import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './ContactsLeaderboard.css';

interface ContactsLeaderboardProps {
    user: any;
    onNavigate: (page: string) => void;
}

interface ContactPoints {
    id: string;
    nom: string;
    avatar_url: string | null;
    email: string;
    points: number;
    taches_terminees: number;
}

export function ContactsLeaderboard({ user, onNavigate }: ContactsLeaderboardProps) {
    const [rankedContacts, setRankedContacts] = useState<ContactPoints[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeaderboard();
    }, []);

    const fetchLeaderboard = async () => {
        setLoading(true);

        // Step 1: Get accepted permanent contacts of the current user
        const { data: contacts } = await supabase
            .from('contacts_permanents')
            .select('contact_id')
            .eq('proprietaire_id', user.id)
            .eq('statut', 'accepte');

        if (!contacts || contacts.length === 0) {
            setRankedContacts([]);
            setLoading(false);
            return;
        }

        const contactIds = contacts.map(c => c.contact_id);

        // Step 2: Get points from the view for these contacts
        const { data: pointsData } = await supabase
            .from('vue_points_contacts')
            .select('*')
            .in('id', contactIds)
            .order('points', { ascending: false });

        if (pointsData) {
            setRankedContacts(pointsData as ContactPoints[]);
        }

        setLoading(false);
    };

    // Stats summary
    const totalPoints = rankedContacts.reduce((acc, c) => acc + c.points, 0);
    const totalTasksDone = rankedContacts.reduce((acc, c) => acc + c.taches_terminees, 0);
    const activeContacts = rankedContacts.filter(c => c.points > 0).length;

    // Podium: top 3
    const top3 = rankedContacts.slice(0, 3);
    const restOfList = rankedContacts.slice(3);

    // Podium order: 2nd, 1st, 3rd
    const podiumOrder = top3.length >= 3
        ? [top3[1], top3[0], top3[2]]
        : top3.length === 2
            ? [top3[1], top3[0]]
            : top3;

    const podiumClasses = top3.length >= 3
        ? ['silver', 'gold', 'bronze']
        : top3.length === 2
            ? ['silver', 'gold']
            : ['gold'];

    const getLevel = (points: number) => Math.floor(points / 100) + 1;
    const getXpInLevel = (points: number) => points % 100;

    const getAvatarUrl = (contact: ContactPoints) => {
        return contact.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(contact.nom || 'U')}&background=8c2bee&color=fff`;
    };

    return (
        <div className="leaderboard-container">
            <div className="lb-bg-blob-1"></div>
            <div className="lb-bg-blob-2"></div>

            {/* Header */}
            <header className="lb-header">
                <button className="lb-back-btn" onClick={() => onNavigate('back')}>
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <h1 className="lb-page-title">
                    <span className="lb-trophy-icon">🏆</span>
                    Classement
                </h1>
                <div style={{ width: '2.5rem' }}></div>
            </header>

            {/* Scrollable Content */}
            <div className="lb-scroll">
                {loading ? (
                    <div className="lb-loading">
                        <div className="lb-loading-spinner"></div>
                        <p className="lb-loading-text">Chargement du classement...</p>
                    </div>
                ) : rankedContacts.length === 0 ? (
                    <div className="lb-empty-state">
                        <span className="material-symbols-outlined lb-empty-icon">emoji_events</span>
                        <h3 className="lb-empty-title">Aucun contact classé</h3>
                        <p className="lb-empty-desc">
                            Ajoutez des contacts permanents et invitez-les dans des tâches collectives pour voir leur classement ici.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Stats Summary */}
                        <div className="lb-stats-summary">
                            <div className="lb-stat-box">
                                <p className="lb-stat-value gold-text">{totalPoints}</p>
                                <p className="lb-stat-label">Pts Total</p>
                            </div>
                            <div className="lb-stat-box">
                                <p className="lb-stat-value green-text">{totalTasksDone}</p>
                                <p className="lb-stat-label">Tâches</p>
                            </div>
                            <div className="lb-stat-box">
                                <p className="lb-stat-value purple-text">{activeContacts}</p>
                                <p className="lb-stat-label">Actifs</p>
                            </div>
                        </div>

                        {/* Podium */}
                        {top3.length > 0 && (
                            <div className="lb-podium-section">
                                <div className="lb-podium">
                                    {podiumOrder.map((contact, i) => {
                                        const cls = podiumClasses[i];
                                        const rank = cls === 'gold' ? 1 : cls === 'silver' ? 2 : 3;
                                        return (
                                            <div key={contact.id} className={`lb-podium-item ${cls}`}>
                                                <div className="lb-podium-avatar-wrapper">
                                                    <img
                                                        src={getAvatarUrl(contact)}
                                                        alt={contact.nom}
                                                        className="lb-podium-avatar"
                                                    />
                                                    <div className="lb-podium-medal">{rank}</div>
                                                </div>
                                                <p className="lb-podium-name">{contact.nom || 'Utilisateur'}</p>
                                                <p className="lb-podium-points">{contact.points} pts</p>
                                                <div className="lb-podium-bar">
                                                    <span className="lb-podium-rank">#{rank}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Full Ranking List */}
                        <div className="lb-list-section">
                            <h3 className="lb-list-title">
                                <span className="material-symbols-outlined">leaderboard</span>
                                Classement complet
                            </h3>
                            {rankedContacts.map((contact, index) => {
                                const level = getLevel(contact.points);
                                const xpInLevel = getXpInLevel(contact.points);

                                return (
                                    <div key={contact.id} className="lb-contact-card">
                                        <div className="lb-rank-badge">
                                            {index + 1}
                                        </div>
                                        <img
                                            src={getAvatarUrl(contact)}
                                            alt={contact.nom}
                                            className="lb-contact-avatar"
                                        />
                                        <div className="lb-contact-info">
                                            <p className="lb-contact-name">{contact.nom || 'Utilisateur'}</p>
                                            <p className="lb-contact-level">Niveau {level}</p>
                                        </div>
                                        <div className="lb-contact-xp-section">
                                            <span className="lb-contact-pts">{contact.points} pts</span>
                                            <div className="lb-contact-xp-bar-bg">
                                                <div
                                                    className="lb-contact-xp-bar-fill"
                                                    style={{ width: `${xpInLevel}%` }}
                                                ></div>
                                            </div>
                                            <span className="lb-contact-tasks-count">
                                                {contact.taches_terminees} tâche{contact.taches_terminees !== 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
