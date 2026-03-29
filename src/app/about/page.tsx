'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
    ArrowLeft,
    ArrowRight,
    Info,
    Mail,
    MessageSquare,
    Upload,
    Shuffle,
    Shield,
    BarChart3,
    WifiOff,
    Globe,
    Chrome,
    Github,
    Menu,
    X,
} from 'lucide-react';
import { useTranslation, LanguageSwitcher } from '../../i18n';

export default function AboutPage() {
    const { t } = useTranslation();
    const [navOpen, setNavOpen] = useState(false);

    return (
        <div className="page-wrapper">
            <main className="privacy-page">
                <nav className="landing-nav">
                    <div className="landing-nav-inner">
                        <Link href="/" className="nav-brand">
                            <img src="/logo.svg" alt="SendStack" width={32} height={32} />
                            <span className="nav-brand-text">SendStack</span>
                        </Link>
                        <button className="nav-toggle" onClick={() => setNavOpen(!navOpen)} aria-label="Toggle navigation">
                            {navOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                        <div className={`nav-links${navOpen ? ' nav-open' : ''}`}>
                            <LanguageSwitcher />
                            <Link href="/" className="nav-link" onClick={() => setNavOpen(false)}>
                                <ArrowLeft size={14} /> {t('nav.backToHome')}
                            </Link>
                        </div>
                    </div>
                </nav>

                <div className="privacy-content">
                    <div className="privacy-header">
                        <div className="privacy-icon-wrap">
                            <Info size={32} />
                        </div>
                        <h1>{t('about.title')}</h1>
                        <p className="privacy-updated">{t('about.tagline')}</p>
                    </div>

                    <section className="privacy-section">
                        <h2>{t('about.whatIsTitle')}</h2>
                        <p>{t('about.whatIsP1')}</p>
                        <p>{t('about.whatIsP2')}</p>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('about.platformsTitle')}</h2>
                        <ul className="privacy-list">
                            <li><strong><Globe size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.platformWeb')}</strong> — {t('about.platformWebDesc')}</li>
                            <li><strong><Chrome size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.platformExt')}</strong> — {t('about.platformExtDesc')}</li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('about.featuresTitle')}</h2>
                        <ul className="privacy-list">
                            <li><strong><Mail size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.featureEmail')}</strong> — {t('about.featureEmailDesc')}</li>
                            <li><strong><MessageSquare size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.featureWhatsApp')}</strong> — {t('about.featureWhatsAppDesc')}</li>
                            <li><strong><Upload size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.featureCsv')}</strong> — {t('about.featureCsvDesc')}</li>
                            <li><strong><Shuffle size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.featureSpin')}</strong> — {t('about.featureSpinDesc')}</li>
                            <li><strong><Shield size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.featureSafety')}</strong> — {t('about.featureSafetyDesc')}</li>
                            <li><strong><BarChart3 size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.featureProgress')}</strong> — {t('about.featureProgressDesc')}</li>
                            <li><strong><WifiOff size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> {t('about.featureOffline')}</strong> — {t('about.featureOfflineDesc')}</li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('about.whyTitle')}</h2>
                        <p>{t('about.whyP1')}</p>
                        <p>{t('about.whyP2')}</p>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('about.builtByTitle')}</h2>
                        <p>{t('about.builtByDesc')}</p>
                        <p>
                            <a href="https://qobouli.com" target="_blank" rel="noopener noreferrer" className="privacy-repo-link">
                                qobouli.com
                            </a>
                        </p>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('about.openSourceTitle')}</h2>
                        <p>{t('about.openSourceDesc')}</p>
                        <p>
                            <a href="https://github.com/mohamed-arabi16/SendStack" target="_blank" rel="noopener noreferrer" className="privacy-repo-link">
                                <Github size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> github.com/mohamed-arabi16/SendStack
                            </a>
                        </p>
                    </section>

                    <section className="privacy-section" style={{ textAlign: 'center', paddingTop: '2rem' }}>
                        <Link href="/dashboard" className="platform-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {t('about.ctaOpenApp')} <ArrowRight size={14} />
                        </Link>
                    </section>
                </div>

                <footer className="landing-footer">
                    <div className="footer-inner">
                        <div className="footer-brand">
                            <img src="/logo.svg" alt="SendStack" width={24} height={24} />
                            <span>SendStack</span>
                        </div>
                        <div className="footer-links">
                            <Link href="/">{t('footer.home')}</Link>
                            <Link href="/privacy">{t('footer.privacyPolicy')}</Link>
                            <Link href="/faq">{t('nav.faq')}</Link>
                            <a href="https://github.com/mohamed-arabi16/SendStack" target="_blank" rel="noopener noreferrer">
                                {t('footer.sourceCode')}
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
