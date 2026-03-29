'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, HelpCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation, LanguageSwitcher } from '../../i18n';

function FaqItem({ question, answer }: { question: string; answer: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div
            className="privacy-section"
            style={{
                cursor: 'pointer',
                borderBottom: '1px solid var(--border-light)',
                paddingBottom: '1.25rem',
                marginBottom: '0.5rem',
            }}
            onClick={() => setOpen(!open)}
        >
            <h3 style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 600,
            }}>
                {question}
                <ChevronDown
                    size={18}
                    style={{
                        transition: 'transform 0.2s',
                        transform: open ? 'rotate(180deg)' : 'rotate(0)',
                        flexShrink: 0,
                        marginLeft: '1rem',
                        color: 'var(--text-tertiary)',
                    }}
                />
            </h3>
            {open && (
                <p style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                    {answer}
                </p>
            )}
        </div>
    );
}

export default function FaqPage() {
    const { t } = useTranslation();

    const faqs = [
        { q: t('faq.q1'), a: t('faq.a1') },
        { q: t('faq.q2'), a: t('faq.a2') },
        { q: t('faq.q3'), a: t('faq.a3') },
        { q: t('faq.q4'), a: t('faq.a4') },
        { q: t('faq.q5'), a: t('faq.a5') },
        { q: t('faq.q6'), a: t('faq.a6') },
        { q: t('faq.q7'), a: t('faq.a7') },
    ];

    return (
        <div className="page-wrapper">
            <main className="privacy-page">
                <nav className="landing-nav">
                    <div className="landing-nav-inner">
                        <Link href="/" className="nav-brand">
                            <img src="/logo.svg" alt="SendStack" width={32} height={32} />
                            <span className="nav-brand-text">SendStack</span>
                        </Link>
                        <div className="nav-links">
                            <LanguageSwitcher />
                            <Link href="/" className="nav-link">
                                <ArrowLeft size={14} /> {t('nav.backToHome')}
                            </Link>
                        </div>
                    </div>
                </nav>

                <div className="privacy-content">
                    <div className="privacy-header">
                        <div className="privacy-icon-wrap">
                            <HelpCircle size={32} />
                        </div>
                        <h1>{t('faq.title')}</h1>
                        <p className="privacy-updated">{t('faq.subtitle')}</p>
                    </div>

                    {faqs.map((faq, i) => (
                        <FaqItem key={i} question={faq.q} answer={faq.a} />
                    ))}

                    <section className="privacy-section" style={{ textAlign: 'center', paddingTop: '2rem', borderBottom: 'none' }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                            {t('faq.moreQuestions')}
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href="/dashboard" className="platform-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                {t('faq.tryIt')} <ArrowRight size={14} />
                            </Link>
                            <a
                                href="https://github.com/mohamed-arabi16/Bulk-Email-sender/issues"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="platform-cta"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            >
                                {t('faq.askOnGithub')} <ArrowRight size={14} />
                            </a>
                        </div>
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
                            <Link href="/about">{t('nav.about')}</Link>
                            <Link href="/privacy">{t('footer.privacyPolicy')}</Link>
                            <a href="https://github.com/mohamed-arabi16/Bulk-Email-sender" target="_blank" rel="noopener noreferrer">
                                {t('footer.sourceCode')}
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
