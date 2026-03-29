'use client';

import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { useTranslation, LanguageSwitcher } from '../../i18n';

export default function PrivacyPage() {
    const { t } = useTranslation();

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
                            <Shield size={32} />
                        </div>
                        <h1>{t('privacy.title')}</h1>
                        <p className="privacy-updated">{t('privacy.lastUpdated')}</p>
                    </div>

                    <section className="privacy-section">
                        <h2>{t('privacy.overviewTitle')}</h2>
                        <p>{t('privacy.overviewP1')}</p>
                        <p>{t('privacy.overviewP2')}</p>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('privacy.dataCollectTitle')}</h2>
                        <p dangerouslySetInnerHTML={{ __html: t('privacy.dataCollectIntro') }} />
                        <div className="privacy-table-wrap">
                            <table className="privacy-table">
                                <thead>
                                    <tr>
                                        <th>{t('privacy.tableHeaderData')}</th>
                                        <th>{t('privacy.tableHeaderWhere')}</th>
                                        <th>{t('privacy.tableHeaderPurpose')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>{t('privacy.tableRow1Data')}</td>
                                        <td><code>{t('privacy.tableRow1Where')}</code></td>
                                        <td>{t('privacy.tableRow1Purpose')}</td>
                                    </tr>
                                    <tr>
                                        <td>{t('privacy.tableRow2Data')}</td>
                                        <td><code>{t('privacy.tableRow2Where')}</code></td>
                                        <td>{t('privacy.tableRow2Purpose')}</td>
                                    </tr>
                                    <tr>
                                        <td>{t('privacy.tableRow3Data')}</td>
                                        <td><code>{t('privacy.tableRow3Where')}</code></td>
                                        <td>{t('privacy.tableRow3Purpose')}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p>{t('privacy.dataCollectWebApp')}</p>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('privacy.noCollectTitle')}</h2>
                        <ul className="privacy-list">
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.noCollect1') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.noCollect2') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.noCollect3') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.noCollect4') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.noCollect5') }} />
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('privacy.thirdPartyTitle')}</h2>
                        <p>{t('privacy.thirdPartyIntro')}</p>
                        <ul className="privacy-list">
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.thirdPartyGmail') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.thirdPartyWhatsApp') }} />
                        </ul>
                        <p>{t('privacy.thirdPartyPolicies')}</p>
                        <ul className="privacy-list">
                            <li>
                                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                                    {t('privacy.googlePrivacy')}
                                </a>
                            </li>
                            <li>
                                <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                                    {t('privacy.metaPrivacy')}
                                </a>
                            </li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('privacy.retentionTitle')}</h2>
                        <ul className="privacy-list">
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.retention1') }} />
                            <li dangerouslySetInnerHTML={{ __html: t('privacy.retention2') }} />
                            <li>{t('privacy.retention3')}</li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('privacy.childrenTitle')}</h2>
                        <p>{t('privacy.childrenDesc')}</p>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('privacy.changesTitle')}</h2>
                        <p>{t('privacy.changesDesc')}</p>
                        <p>
                            <a
                                href="https://github.com/mohamed-arabi16/Bulk-Email-sender/blob/main/chrome-extension/store/privacy-policy.md"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="privacy-repo-link"
                            >
                                github.com/mohamed-arabi16/Bulk-Email-sender
                            </a>
                        </p>
                    </section>

                    <section className="privacy-section">
                        <h2>{t('privacy.contactTitle')}</h2>
                        <p>{t('privacy.contactDesc')}</p>
                        <p>
                            <a
                                href="https://github.com/mohamed-arabi16/Bulk-Email-sender/issues"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="privacy-repo-link"
                            >
                                github.com/mohamed-arabi16/Bulk-Email-sender/issues
                            </a>
                        </p>
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
                            <Link href="/dashboard">{t('footer.webApp')}</Link>
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
