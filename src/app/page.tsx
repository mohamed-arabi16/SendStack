'use client';

import Link from 'next/link';
import {
    Mail,
    Upload,
    Shield,
    Zap,
    Clock,
    Chrome,
    Globe,
    ArrowRight,
    CheckCircle2,
    Shuffle,
    WifiOff,
    SlidersHorizontal,
    BarChart3,
} from 'lucide-react';
import HeroSection from '../components/HeroSection';
import ScrollReveal from '../components/ScrollReveal';
import { useTranslation, LanguageSwitcher } from '../i18n';

export default function LandingPage() {
    const { t } = useTranslation();

    return (
        <div className="page-wrapper">
            <main className="landing">
                {/* Nav */}
                <nav className="landing-nav">
                    <div className="landing-nav-inner">
                        <Link href="/" className="nav-brand">
                            <img src="/logo.svg" alt="SendStack" width={32} height={32} />
                            <span className="nav-brand-text">SendStack</span>
                        </Link>
                        <div className="nav-links">
                            <a href="#features" className="nav-link">{t('nav.features')}</a>
                            <a href="#how-it-works" className="nav-link">{t('nav.howItWorks')}</a>
                            <Link href="/privacy" className="nav-link">{t('nav.privacy')}</Link>
                            <LanguageSwitcher />
                            <Link href="/dashboard" className="nav-cta-link">
                                {t('nav.openApp')} <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </nav>

                {/* Hero */}
                <HeroSection />

                {/* Platforms */}
                <section className="platforms" id="platforms">
                    <div className="section-inner">
                        <ScrollReveal>
                            <h2 className="section-title">{t('platforms.title')}</h2>
                            <p className="section-subtitle">{t('platforms.subtitle')}</p>
                        </ScrollReveal>
                        <ScrollReveal stagger>
                            <div className="platform-grid">
                                <div className="platform-card">
                                    <div className="platform-icon web">
                                        <Globe size={28} />
                                    </div>
                                    <h3 className="platform-name">{t('platforms.webApp')}</h3>
                                    <p className="platform-desc">{t('platforms.webAppDesc')}</p>
                                    <ul className="platform-features">
                                        <li><CheckCircle2 size={15} /> {t('platforms.webFeature1')}</li>
                                        <li><CheckCircle2 size={15} /> {t('platforms.webFeature2')}</li>
                                        <li><CheckCircle2 size={15} /> {t('platforms.webFeature3')}</li>
                                        <li><CheckCircle2 size={15} /> {t('platforms.webFeature4')}</li>
                                        <li><CheckCircle2 size={15} /> {t('platforms.webFeature5')}</li>
                                    </ul>
                                    <Link href="/dashboard" className="platform-cta">
                                        {t('platforms.openWebApp')} <ArrowRight size={14} />
                                    </Link>
                                </div>

                                <div className="platform-card">
                                    <div className="platform-icon ext">
                                        <Chrome size={28} />
                                    </div>
                                    <h3 className="platform-name">{t('platforms.chromeExtension')}</h3>
                                    <p className="platform-desc">{t('platforms.chromeDesc')}</p>
                                    <ul className="platform-features">
                                        <li><CheckCircle2 size={15} /> {t('platforms.chromeFeature1')}</li>
                                        <li><CheckCircle2 size={15} /> {t('platforms.chromeFeature2')}</li>
                                        <li><CheckCircle2 size={15} /> {t('platforms.chromeFeature3')}</li>
                                        <li><CheckCircle2 size={15} /> {t('platforms.chromeFeature4')}</li>
                                        <li><CheckCircle2 size={15} /> {t('platforms.chromeFeature5')}</li>
                                    </ul>
                                    <a
                                        href="https://chromewebstore.google.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="platform-cta"
                                    >
                                        {t('platforms.getExtension')} <ArrowRight size={14} />
                                    </a>
                                </div>
                            </div>
                        </ScrollReveal>
                    </div>
                </section>

                {/* Features */}
                <section className="features" id="features">
                    <div className="section-inner">
                        <ScrollReveal>
                            <h2 className="section-title">{t('features.title')}</h2>
                            <p className="section-subtitle">{t('features.subtitle')}</p>
                        </ScrollReveal>
                        <ScrollReveal stagger>
                            <div className="features-grid">
                                <div className="feature-card">
                                    <div className="feature-icon"><Upload size={20} /></div>
                                    <h3>{t('features.csvTitle')}</h3>
                                    <p>{t('features.csvDesc')}</p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-icon"><Shuffle size={20} /></div>
                                    <h3>{t('features.spinTitle')}</h3>
                                    <p>{t('features.spinDesc')}</p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-icon"><Shield size={20} /></div>
                                    <h3>{t('features.safetyTitle')}</h3>
                                    <p>{t('features.safetyDesc')}</p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-icon"><BarChart3 size={20} /></div>
                                    <h3>{t('features.progressTitle')}</h3>
                                    <p>{t('features.progressDesc')}</p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-icon"><WifiOff size={20} /></div>
                                    <h3>{t('features.offlineTitle')}</h3>
                                    <p>{t('features.offlineDesc')}</p>
                                </div>
                                <div className="feature-card">
                                    <div className="feature-icon"><SlidersHorizontal size={20} /></div>
                                    <h3>{t('features.syncTitle')}</h3>
                                    <p>{t('features.syncDesc')}</p>
                                </div>
                            </div>
                        </ScrollReveal>
                    </div>
                </section>

                {/* How it works */}
                <section className="how-it-works" id="how-it-works">
                    <div className="section-inner">
                        <ScrollReveal>
                            <h2 className="section-title">{t('steps.title')}</h2>
                        </ScrollReveal>
                        <ScrollReveal stagger>
                            <div className="steps-row">
                                <div className="step-card">
                                    <div className="step-num">1</div>
                                    <div className="step-icon-wrap"><Upload size={24} /></div>
                                    <h3>{t('steps.step1Title')}</h3>
                                    <p>{t('steps.step1Desc')}</p>
                                </div>
                                <div className="step-divider">
                                    <ArrowRight size={20} />
                                </div>
                                <div className="step-card">
                                    <div className="step-num">2</div>
                                    <div className="step-icon-wrap"><Mail size={24} /></div>
                                    <h3>{t('steps.step2Title')}</h3>
                                    <p>{t('steps.step2Desc')}</p>
                                </div>
                                <div className="step-divider">
                                    <ArrowRight size={20} />
                                </div>
                                <div className="step-card">
                                    <div className="step-num">3</div>
                                    <div className="step-icon-wrap"><Zap size={24} /></div>
                                    <h3>{t('steps.step3Title')}</h3>
                                    <p>{t('steps.step3Desc')}</p>
                                </div>
                            </div>
                        </ScrollReveal>
                    </div>
                </section>

                {/* CTA */}
                <section className="final-cta">
                    <div className="section-inner">
                        <ScrollReveal>
                            <div className="cta-card">
                                <Clock size={32} className="cta-icon" />
                                <h2>{t('cta.title')}</h2>
                                <p>{t('cta.subtitle')}</p>
                                <div className="cta-actions">
                                    <Link href="/dashboard" className="btn-hero-primary">
                                        {t('cta.openWebApp')}
                                    </Link>
                                    <a
                                        href="https://chromewebstore.google.com"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-hero-secondary"
                                    >
                                        {t('cta.chromeExtension')}
                                    </a>
                                </div>
                            </div>
                        </ScrollReveal>
                    </div>
                </section>

                {/* Footer */}
                <footer className="landing-footer">
                    <div className="footer-inner">
                        <div className="footer-brand">
                            <img src="/logo.svg" alt="SendStack" width={24} height={24} />
                            <span>SendStack</span>
                        </div>
                        <div className="footer-links">
                            <Link href="/privacy">{t('footer.privacyPolicy')}</Link>
                            <a href="https://github.com/mohamed-arabi16/Bulk-Email-sender" target="_blank" rel="noopener noreferrer">
                                {t('footer.sourceCode')}
                            </a>
                            <a href="https://github.com/mohamed-arabi16/Bulk-Email-sender/issues" target="_blank" rel="noopener noreferrer">
                                {t('footer.support')}
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
