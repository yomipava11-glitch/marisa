import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './Profile.css';

interface ProfileProps {
    user: any;
    onSignOut: () => void;
    onNavigate: (page: string) => void;
}

export function Profile({ user, onSignOut, onNavigate }: ProfileProps) {
    const [fullName, setFullName] = useState(user.user_metadata?.full_name || '');
    const email = user.email || '';
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [stats, setStats] = useState({ completed: 0, inProgress: 0, efficiency: 0 });
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        // Fetch tasks to calculate stats
        const { data: tasks } = await supabase
            .from('taches')
            .select('*')
            .eq('createur_id', user.id);

        if (tasks) {
            const completed = tasks.filter(t => t.statut === 'terminee').length;
            const inProgress = tasks.length - completed;
            const efficiency = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
            setStats({ completed, inProgress, efficiency });
        }
    };

    const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type and size
        if (!file.type.startsWith('image/')) {
            setMessage('Veuillez sélectionner une image.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setMessage('L\'image ne doit pas dépasser 2 Mo.');
            setTimeout(() => setMessage(''), 3000);
            return;
        }

        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    const uploadAvatar = async (): Promise<string | null> => {
        if (!avatarFile) return null;
        setUploadingAvatar(true);

        const fileExt = avatarFile.name.split('.').pop();
        const filePath = `${user.id}/avatar.${fileExt}`;

        // Upload (upsert) to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            setUploadingAvatar(false);
            return null;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        setUploadingAvatar(false);
        // Add cache buster to force refresh
        return urlData.publicUrl + '?t=' + Date.now();
    };

    const handleSaveWithAvatar = async () => {
        setSaving(true);
        setMessage('');

        let newAvatarUrl: string | null = null;

        // Upload avatar if changed
        if (avatarFile) {
            newAvatarUrl = await uploadAvatar();
            if (!newAvatarUrl) {
                setMessage('Erreur lors du téléchargement de la photo.');
                setSaving(false);
                return;
            }
        }

        // Build update data
        const updateData: any = { full_name: fullName };
        if (newAvatarUrl) updateData.avatar_url = newAvatarUrl;

        // Update auth metadata
        const { error } = await supabase.auth.updateUser({ data: updateData });

        if (error) {
            setMessage('Erreur lors de la mise à jour du profil.');
            console.error(error);
        } else {
            // Update profils table
            const profileUpdate: any = { nom: fullName };
            if (newAvatarUrl) profileUpdate.avatar_url = newAvatarUrl;

            await supabase
                .from('profils')
                .update(profileUpdate)
                .eq('id', user.id);

            setMessage('Profil mis à jour avec succès !');
            setAvatarFile(null); // Reset file selection
        }

        setSaving(false);
        setTimeout(() => setMessage(''), 3000);
    };

    const avatarUrl = user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${fullName || 'User'}&background=8c2bee&color=fff`;

    return (
        <div className="profile-container">
            <div className="profile-scroll">
                {/* Header Actions */}
                <div className="profile-header-actions">
                    <button className="icon-button" onClick={() => onNavigate('back')}>
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <button className="icon-button" onClick={onSignOut} style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                        <span className="material-symbols-outlined">logout</span>
                    </button>
                </div>

                {/* Avatar Section */}
                <div className="profile-avatar-section">
                    <div className="profile-avatar-wrapper" onClick={() => fileInputRef.current?.click()} style={{ cursor: 'pointer', position: 'relative' }}>
                        <img src={avatarPreview || avatarUrl} alt="Avatar" className="profile-avatar" />
                        <div className="avatar-camera-overlay">
                            <span className="material-symbols-outlined">photo_camera</span>
                        </div>
                        {uploadingAvatar && (
                            <div className="avatar-uploading-overlay">
                                <div className="avatar-spinner"></div>
                            </div>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarSelect}
                        style={{ display: 'none' }}
                    />
                    <div style={{ textAlign: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>{fullName || 'User'}</h2>
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Cliquez sur la photo pour la modifier</p>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="profile-details">
                    <div className="input-group">
                        <label className="input-label">Nom complet</label>
                        <input
                            type="text"
                            className="glass-input"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Votre nom"
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Adresse Email</label>
                        <input
                            type="email"
                            className="glass-input"
                            value={email}
                            disabled
                            title="L'email ne peut pas être modifié ici."
                        />
                    </div>
                </div>

                {/* Productivity Stats */}
                <div className="stats-section">
                    <div className="stats-card">
                        <div className="stats-blob"></div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.completed}</span>
                            <span className="stat-label">Terminées</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.inProgress}</span>
                            <span className="stat-label">En cours</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-value">{stats.efficiency}%</span>
                            <span className="stat-label">Efficacité</span>
                        </div>
                    </div>
                </div>

                {/* Settings (UI Only) */}
                <div className="settings-section">
                    <h3 className="settings-title">Paramètres</h3>

                    <div className="setting-item" onClick={() => onNavigate('contacts')} style={{ cursor: 'pointer' }}>
                        <div className="setting-info">
                            <div className="setting-icon" style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#a855f7' }}>
                                <span className="material-symbols-outlined">group</span>
                            </div>
                            <span className="setting-label">Contacts Permanents</span>
                        </div>
                        <span className="material-symbols-outlined" style={{ color: '#64748b' }}>chevron_right</span>
                    </div>


                    <div className="setting-item">
                        <div className="setting-info">
                            <div className="setting-icon">
                                <span className="material-symbols-outlined">notifications</span>
                            </div>
                            <span className="setting-label">Notifications</span>
                        </div>
                        <div style={{ padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', fontSize: '0.75rem' }}>Activé</div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <div className="setting-icon" style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' }}>
                                <span className="material-symbols-outlined">lock</span>
                            </div>
                            <span className="setting-label">Confidentialité</span>
                        </div>
                        <span className="material-symbols-outlined" style={{ color: '#64748b' }}>chevron_right</span>
                    </div>
                </div>

                {/* Save Button */}
                <div className="save-button-container">
                    {message && <p style={{ textAlign: 'center', margin: '0 0 1rem 0', color: message.includes('Erreur') ? '#ef4444' : '#4ade80', fontSize: '0.875rem' }}>{message}</p>}
                    <button
                        className="save-button"
                        onClick={handleSaveWithAvatar}
                        disabled={saving || uploadingAvatar}
                    >
                        {saving ? 'Sauvegarde...' : uploadingAvatar ? 'Téléchargement...' : 'Sauvegarder les modifications'}
                    </button>
                </div>
            </div>

            {/* Bottom Nav */}
            <div className="bottom-nav-container">
                <div className="bottom-nav">
                    <button className="nav-item" onClick={() => onNavigate('dashboard')}>
                        <span className="material-symbols-outlined">bar_chart</span>
                        <span className="nav-label">Stats</span>
                    </button>
                    <button className="nav-item" onClick={() => onNavigate('collective')}>
                        <span className="material-symbols-outlined">group</span>
                        <span className="nav-label">Collectif</span>
                    </button>
                    <button className="nav-item active">
                        <span className="material-symbols-outlined fill-[1]">account_circle</span>
                        <span className="nav-label">Profil</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
