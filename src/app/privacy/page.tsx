import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy — SendStack',
    description: 'Privacy policy for the SendStack bulk messaging platform and Chrome extension.',
};

export default function PrivacyPage() {
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
                            <Link href="/" className="nav-link">
                                <ArrowLeft size={14} /> Back to Home
                            </Link>
                        </div>
                    </div>
                </nav>

                <div className="privacy-content">
                    <div className="privacy-header">
                        <div className="privacy-icon-wrap">
                            <Shield size={32} />
                        </div>
                        <h1>Privacy Policy</h1>
                        <p className="privacy-updated">Last updated: March 29, 2026</p>
                    </div>

                    <section className="privacy-section">
                        <h2>Overview</h2>
                        <p>
                            SendStack — Bulk Messaging (&ldquo;the Extension&rdquo; / &ldquo;the App&rdquo;) is a browser
                            extension and web application for Google Chrome that helps you send personalised bulk emails
                            and WhatsApp messages directly from Gmail and WhatsApp Web.
                        </p>
                        <p>
                            We are committed to protecting your privacy. This policy explains exactly what data
                            the Extension and Web App collect, how it is stored, and what it is never used for.
                        </p>
                    </section>

                    <section className="privacy-section">
                        <h2>Data We Collect</h2>
                        <p>
                            The Extension stores the following data <strong>locally in your browser</strong> using{' '}
                            <code>chrome.storage.local</code> and <code>chrome.storage.sync</code>:
                        </p>
                        <div className="privacy-table-wrap">
                            <table className="privacy-table">
                                <thead>
                                    <tr>
                                        <th>Data</th>
                                        <th>Where Stored</th>
                                        <th>Purpose</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>Uploaded CSV rows (contacts)</td>
                                        <td><code>chrome.storage.local</code></td>
                                        <td>Populate the send queue; cleared when you upload a new CSV or remove the extension</td>
                                    </tr>
                                    <tr>
                                        <td>User settings (delay, limits)</td>
                                        <td><code>chrome.storage.sync</code></td>
                                        <td>Restore your preferences across sessions and Chrome profiles</td>
                                    </tr>
                                    <tr>
                                        <td>Daily send counter</td>
                                        <td><code>chrome.storage.local</code></td>
                                        <td>Enforce the daily sending limit you configure</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p>
                            The Web App processes CSV data and SMTP credentials entirely in your browser session
                            and on your self-hosted server. No data is stored permanently on external servers.
                        </p>
                    </section>

                    <section className="privacy-section">
                        <h2>Data We Do Not Collect</h2>
                        <ul className="privacy-list">
                            <li>
                                <strong>No email content is read.</strong> The Extension only opens the Gmail compose
                                window and fills in the To, Subject, and Body fields you provide via your template.
                                It does not read, scan, or transmit any existing emails.
                            </li>
                            <li>
                                <strong>No message history is read.</strong> The Extension does not access your WhatsApp
                                message history or contact list.
                            </li>
                            <li>
                                <strong>No data is transmitted to external servers.</strong> All CSV data and settings
                                remain on your device. The Extension makes no outbound network requests of its own.
                            </li>
                            <li>
                                <strong>No analytics or telemetry.</strong> The Extension does not include any analytics
                                SDK, tracking pixel, or crash-reporting service.
                            </li>
                            <li>
                                <strong>No user accounts.</strong> The Extension does not require you to create an account
                                or log in.
                            </li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>Third-Party Services</h2>
                        <p>
                            The Extension does not integrate with any third-party services. It interacts only with:
                        </p>
                        <ul className="privacy-list">
                            <li>
                                <strong>Gmail</strong> (<code>mail.google.com</code>) — by injecting a sidebar panel
                                and automating the native compose window.
                            </li>
                            <li>
                                <strong>WhatsApp Web</strong> (<code>web.whatsapp.com</code>) — by injecting a sidebar
                                panel and navigating to <code>web.whatsapp.com/send?phone=...</code> URLs.
                            </li>
                        </ul>
                        <p>These services have their own privacy policies:</p>
                        <ul className="privacy-list">
                            <li>
                                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
                                    Google Privacy Policy
                                </a>
                            </li>
                            <li>
                                <a href="https://www.whatsapp.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
                                    Meta / WhatsApp Privacy Policy
                                </a>
                            </li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>Data Retention</h2>
                        <ul className="privacy-list">
                            <li>CSV contact data is retained in <code>chrome.storage.local</code> until you upload a new file or uninstall the Extension.</li>
                            <li>Settings are retained in <code>chrome.storage.sync</code> until you uninstall the Extension or clear Chrome sync data.</li>
                            <li>The daily send counter is reset automatically at midnight each day.</li>
                        </ul>
                    </section>

                    <section className="privacy-section">
                        <h2>Children&apos;s Privacy</h2>
                        <p>
                            The Extension is not directed at children under the age of 13. We do not knowingly
                            collect personal information from children.
                        </p>
                    </section>

                    <section className="privacy-section">
                        <h2>Changes to This Policy</h2>
                        <p>
                            We may update this Privacy Policy from time to time. Any changes will be reflected
                            in the &ldquo;Last updated&rdquo; date at the top of this document and will be committed
                            to the public repository at:
                        </p>
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
                        <h2>Contact</h2>
                        <p>
                            If you have questions about this Privacy Policy or the Extension&apos;s data practices,
                            please open an issue at:
                        </p>
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
                            <Link href="/">Home</Link>
                            <Link href="/dashboard">Web App</Link>
                            <a href="https://github.com/mohamed-arabi16/Bulk-Email-sender" target="_blank" rel="noopener noreferrer">
                                Source Code
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
