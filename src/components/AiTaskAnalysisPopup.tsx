
interface AnalysisData {
    resume?: string;
    sante?: 'bon' | 'moyen' | 'risque';
    points_positifs?: string[];
    risques?: string[];
    recommandations?: string[];
    analyse_logs?: string;
    prochaine_etape?: string;
}

interface AiTaskAnalysisPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onRegenerate: () => void;
    analysisText: string | AnalysisData;
    loading: boolean;
}

const santeConfig = {
    bon: { label: 'Bon état', icon: '✓', color: 'text-green-400', bg: 'bg-green-500/15 border-green-500/30' },
    moyen: { label: 'Attention requise', icon: '⚠', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
    risque: { label: 'Risque élevé', icon: '✕', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
};

export function AiTaskAnalysisPopup({ isOpen, onClose, onRegenerate, analysisText, loading }: AiTaskAnalysisPopupProps) {
    if (!isOpen) return null;

    // Parse analysis — may be a plain string (error msg) or a structured object
    let analysis: AnalysisData | null = null;
    let plainText: string | null = null;

    if (typeof analysisText === 'object' && analysisText !== null) {
        analysis = analysisText as AnalysisData;
    } else if (typeof analysisText === 'string') {
        try {
            const parsed = JSON.parse(analysisText);
            if (typeof parsed === 'object') analysis = parsed;
            else plainText = analysisText;
        } catch {
            plainText = analysisText;
        }
    }

    const sante = analysis?.sante ? santeConfig[analysis.sante] ?? santeConfig.moyen : null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0b0413]/80 backdrop-blur-sm" onClick={onClose}>
            <div
                className="w-full max-w-[500px] bg-[#0f172a] rounded-t-3xl sm:rounded-3xl border border-[#00a651]/25 shadow-[0_0_60px_rgba(0, 166, 81,0.15)] overflow-hidden flex flex-col relative"
                style={{ maxHeight: '90vh' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Glow */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#00a651]/15 to-transparent pointer-events-none" />

                {/* Header */}
                <div className="flex items-center gap-3 p-5 border-b border-white/5 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-[#00a651]/15 border border-[#00a651]/30 flex items-center justify-center shrink-0">
                        {/* Generic AI Sparkles Icon SVG as safe fallback */}
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-base font-bold text-white">Analyse Scrum Master IA</h2>
                        <p className="text-xs text-white/40">Basée sur vos sous-tâches et journaux</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-2 border-[#00a651]/20 animate-pulse" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <svg className="animate-spin h-8 w-8 text-[#00a651]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                </div>
                            </div>
                            <p className="text-sm text-white/50 animate-pulse text-center">Le Scrum Master analyse vos logs et sous-tâches...</p>
                        </div>
                    ) : analysis ? (
                        <>
                            {/* Santé Badge */}
                            {sante && (
                                <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${sante.bg}`}>
                                    <span className={`text-lg font-bold ${sante.color}`}>{sante.icon}</span>
                                    <span className={`font-semibold text-sm ${sante.color}`}>{sante.label}</span>
                                </div>
                            )}

                            {/* Résumé */}
                            {analysis.resume && (
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5 mt-2">
                                    <p className="text-sm text-white/80 leading-relaxed">{analysis.resume}</p>
                                </div>
                            )}

                            {/* Points positifs */}
                            {analysis.points_positifs && analysis.points_positifs.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-green-400/70 mb-2 flex items-center gap-1.5">
                                        <span className="text-sm">✓</span> POINTS POSITIFS
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {analysis.points_positifs.map((p, i) => (
                                            <li key={i} className="text-sm text-white/70 bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2 flex gap-2">
                                                <span className="text-green-400 shrink-0 opacity-50 mt-0.5 text-xs">◆</span>
                                                <span className="leading-snug">{p}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Risques */}
                            {analysis.risques && analysis.risques.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-red-400/70 mb-2 flex items-center gap-1.5 mt-4">
                                        <span className="text-sm">⚠</span> RISQUES
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {analysis.risques.map((r, i) => (
                                            <li key={i} className="text-sm text-white/70 bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2 flex gap-2">
                                                <span className="text-red-400 shrink-0 opacity-50 mt-0.5 text-xs">◆</span>
                                                <span className="leading-snug">{r}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Recommandations */}
                            {analysis.recommandations && analysis.recommandations.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#34d399]/70 mb-2 flex items-center gap-1.5 mt-4">
                                        <span className="text-sm">★</span> RECOMMANDATIONS
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {analysis.recommandations.map((r, i) => (
                                            <li key={i} className="text-sm text-white/70 bg-[#00a651]/5 border border-[#00a651]/10 rounded-lg px-3 py-2 flex gap-2">
                                                <span className="text-[#34d399] shrink-0 opacity-50 mt-0.5 text-xs">→</span>
                                                <span className="leading-snug">{r}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Analyse des logs */}
                            {analysis.analyse_logs && (
                                <div>
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400/70 mb-2 flex items-center gap-1.5 mt-4">
                                        <span className="text-sm">≡</span> ANALYSE DES JOURNAUX
                                    </h3>
                                    <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-4">
                                        <p className="text-sm text-white/70 leading-relaxed">{analysis.analyse_logs}</p>
                                    </div>
                                </div>
                            )}

                            {/* Prochaine étape */}
                            {analysis.prochaine_etape && (
                                <div className="bg-gradient-to-r from-[#00a651]/10 to-transparent border border-[#00a651]/20 rounded-xl p-4 mt-4">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#34d399]/70 mb-1.5 flex items-center gap-1.5">
                                        <span className="text-sm">🚀</span> PROCHAINE ÉTAPE PRIORITAIRE
                                    </h3>
                                    <p className="text-sm text-white/90 font-medium">{analysis.prochaine_etape}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-center py-8">
                            <span className="text-4xl text-white/20 mb-3 block">⚠</span>
                            <p className="text-sm text-white/50">{plainText || "Aucune analyse disponible."}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-white/5 flex gap-3 relative z-10">
                    <button
                        onClick={onRegenerate}
                        disabled={loading}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#00a651] to-[#007a3c] text-white font-semibold text-sm shadow-[0_4px_20px_rgba(0, 166, 81,0.3)] hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <svg className={`${loading ? 'animate-spin' : ''}`} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-9.21l5.94 4.54" />
                        </svg>
                        Régénérer
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-transparent border border-white/10 text-white/70 font-semibold text-sm hover:bg-white/5 active:scale-[0.98] transition-all"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
    );
}

