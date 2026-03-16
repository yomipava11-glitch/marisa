import { useState } from 'react';
import './LandingPage.css';

interface LandingPageProps {
  onLoginClick: () => void;
}

export function LandingPage({ onLoginClick }: LandingPageProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="landing-page-root">
      {/* Floating abstract blobs */}
      <div className="landing-blob blob-1"></div>
      <div className="landing-blob blob-2"></div>
      <div className="landing-blob blob-3"></div>

      {/* Navigation — Glassmorphism */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="nav-brand">
            <div className="nav-logo">
              <span className="material-symbols-outlined">task_alt</span>
            </div>
            <span className="nav-brand-text">GestionTask</span>
          </div>

          <div className="nav-links-desktop">
            <a href="#features">Fonctionnalités</a>
            <a href="#cta">Tarifs</a>
          </div>

          <div className="nav-actions-desktop">
            <button className="nav-link-btn" onClick={onLoginClick}>Connexion</button>
            <button className="btn-glow" onClick={onLoginClick}>Commencer</button>
          </div>

          {/* Mobile burger */}
          <button className="burger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>

        {/* Mobile dropdown */}
        {isMobileMenuOpen && (
          <div className="mobile-menu">
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)}>Fonctionnalités</a>
            <a href="#cta" onClick={() => setIsMobileMenuOpen(false)}>Tarifs</a>
            <div className="mobile-menu-divider"></div>
            <button className="mobile-menu-link" onClick={() => { setIsMobileMenuOpen(false); onLoginClick(); }}>Connexion</button>
            <button className="btn-glow mobile-menu-cta" onClick={() => { setIsMobileMenuOpen(false); onLoginClick(); }}>Commencer</button>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <h1 className="hero-title">
          La gestion de tâches<br />
          <span className="hero-title-accent">intelligente et intuitive</span>
        </h1>

        <p className="hero-subtitle">
          Optimisez vos sprints, collaborez efficacement en équipe et laissez notre Scrum Master IA identifier vos blocages avant qu'ils n'impactent votre vélocité.
        </p>

        <div className="hero-buttons">
          <button className="btn-glow btn-lg" onClick={onLoginClick}>
            Démarrer gratuitement
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
          <button className="btn-outline btn-lg" onClick={onLoginClick}>
            <span className="material-symbols-outlined">play_circle</span>
            Voir la démo
          </button>
        </div>

        {/* Dashboard Mockup — Desktop only */}
        <div className="dashboard-mockup">
          <div className="mockup-titlebar">
            <div className="mockup-dot red"></div>
            <div className="mockup-dot yellow"></div>
            <div className="mockup-dot green"></div>
          </div>
          <div className="mockup-body">
            <div className="mockup-sidebar">
              <div className="mockup-bar w60"></div>
              <div className="mockup-bar w80"></div>
              <div className="mockup-bar w40"></div>
              <div className="mockup-bar w70"></div>
            </div>
            <div className="mockup-content">
              <div className="mockup-row">
                <div className="mockup-stat accent"></div>
                <div className="mockup-stat"></div>
                <div className="mockup-stat"></div>
              </div>
              <div className="mockup-chart">
                <div className="chart-bar" style={{height:'40%'}}></div>
                <div className="chart-bar accent" style={{height:'70%'}}></div>
                <div className="chart-bar" style={{height:'55%'}}></div>
                <div className="chart-bar accent" style={{height:'85%'}}></div>
                <div className="chart-bar" style={{height:'45%'}}></div>
                <div className="chart-bar accent" style={{height:'60%'}}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <h2 className="section-title">Tout ce dont vous avez besoin</h2>
        <p className="section-subtitle">Des outils puissants pour gérer vos projets avec précision.</p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-symbols-outlined">psychology</span>
            </div>
            <h3>Scrum Master IA</h3>
            <p>Un agent IA qui analyse vos tâches en continu, identifie les risques de blocage et suggère des actions préventives.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-symbols-outlined">groups</span>
            </div>
            <h3>Collaboration Temps Réel</h3>
            <p>Partagez des tâches collectives, modifiez et suivez l'avancement en temps réel avec toute votre équipe.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <span className="material-symbols-outlined">query_stats</span>
            </div>
            <h3>Analytiques Avancées</h3>
            <p>Des tableaux de bord dynamiques avec le suivi de productivité par projet et des scores de santé automatiques.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="cta-section">
        <div className="cta-card">
          <div className="cta-glow"></div>
          <h2>Prêt à transformer votre façon de travailler ?</h2>
          <p>Rejoignez GestionTask et testez toutes les fonctionnalités premium sans engagement.</p>
          <button className="btn-glow btn-lg" onClick={onLoginClick}>
            Créer un compte gratuit
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-top">
          <div className="footer-brand">
            <div className="nav-brand">
              <div className="nav-logo sm">
                <span className="material-symbols-outlined">task_alt</span>
              </div>
              <span className="nav-brand-text">GestionTask</span>
            </div>
            <p className="footer-desc">Simplifiez la gestion de projet grâce à l'intelligence artificielle.</p>
          </div>

          <div className="footer-links-group">
            <h4>Produit</h4>
            <a href="#">Scrum Master IA</a>
            <a href="#">Tâches Collectives</a>
            <a href="#">Tableaux de bord</a>
          </div>

          <div className="footer-links-group">
            <h4>Ressources</h4>
            <a href="#">Blog</a>
            <a href="#">Documentation</a>
            <a href="#">API</a>
          </div>

          <div className="footer-links-group">
            <h4>Société</h4>
            <a href="#">À propos</a>
            <a href="#">Contact</a>
            <a href="#">Confidentialité</a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© 2026 GestionTask. Tous droits réservés.</span>
          <span className="footer-status">
            <span className="status-dot"></span>
            Systèmes opérationnels
          </span>
        </div>
      </footer>
    </div>
  );
}
