import Link from 'next/link';
import {
    Mail,
    MessageCircle,
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

export default function LandingPage() {
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
                            <a href="#features" className="nav-link">Features</a>
                            <a href="#how-it-works" className="nav-link">How It Works</a>
                            <Link href="/privacy" className="nav-link">Privacy</Link>
                            <Link href="/dashboard" className="nav-cta-link">
                                Open App <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </nav>

                {/* Hero */}
                <section className="hero">
                    <div className="hero-inner">
                        <div className="hero-badges">
                            <span className="hero-badge">
                                <Globe size={14} /> Web App
                            </span>
                            <span className="hero-badge">
                                <Chrome size={14} /> Chrome Extension
                            </span>
                        </div>
                        <h1 className="hero-title">
                            Bulk messaging,<br />
                            <span className="hero-accent">without the bulk.</span>
                        </h1>
                        <p className="hero-subtitle">
                            Send personalised emails and WhatsApp messages to hundreds of contacts.
                            Upload a CSV, write your template, hit send. No server, no API keys, no subscriptions.
                        </p>
                        <div className="hero-actions">
                            <Link href="/dashboard" className="btn-hero-primary">
                                <Mail size={18} />
                                Open Web App
                            </Link>
                            <a
                                href="https://chromewebstore.google.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-hero-secondary"
                            >
                                <Chrome size={18} />
                                Get Chrome Extension
                            </a>
                        </div>
                    </div>
                </section>

                {/* Platforms */}
                <section className="platforms" id="platforms">
                    <div className="section-inner">
                        <h2 className="section-title">Two ways to send</h2>
                        <p className="section-subtitle">
                            Choose the workflow that fits you best — or use both.
                        </p>
                        <div className="platform-grid">
                            {/* Web App */}
                            <div className="platform-card">
                                <div className="platform-icon web">
                                    <Globe size={28} />
                                </div>
                                <h3 className="platform-name">Web App</h3>
                                <p className="platform-desc">
                                    Full-featured dashboard for bulk email and WhatsApp messaging.
                                    Connect your own SMTP (Gmail, iCloud+, custom domains) or use WhatsApp Web via QR pairing.
                                </p>
                                <ul className="platform-features">
                                    <li><CheckCircle2 size={15} /> SMTP email with any provider</li>
                                    <li><CheckCircle2 size={15} /> WhatsApp Web QR pairing</li>
                                    <li><CheckCircle2 size={15} /> CSV upload with auto-detected columns</li>
                                    <li><CheckCircle2 size={15} /> Template variables &amp; live preview</li>
                                    <li><CheckCircle2 size={15} /> Real-time send logs</li>
                                </ul>
                                <Link href="/dashboard" className="platform-cta">
                                    Open Web App <ArrowRight size={14} />
                                </Link>
                            </div>

                            {/* Chrome Extension */}
                            <div className="platform-card">
                                <div className="platform-icon ext">
                                    <Chrome size={28} />
                                </div>
                                <h3 className="platform-name">Chrome Extension</h3>
                                <p className="platform-desc">
                                    Lightweight sidebar that lives inside Gmail and WhatsApp Web.
                                    No backend needed — everything runs locally in your browser.
                                </p>
                                <ul className="platform-features">
                                    <li><CheckCircle2 size={15} /> Native Gmail compose automation</li>
                                    <li><CheckCircle2 size={15} /> WhatsApp Web direct messaging</li>
                                    <li><CheckCircle2 size={15} /> Anti-ban delay presets &amp; jitter</li>
                                    <li><CheckCircle2 size={15} /> Spin syntax for unique messages</li>
                                    <li><CheckCircle2 size={15} /> 100% offline — zero data leaves your device</li>
                                </ul>
                                <a
                                    href="https://chromewebstore.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="platform-cta"
                                >
                                    Get Extension <ArrowRight size={14} />
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="features" id="features">
                    <div className="section-inner">
                        <h2 className="section-title">Built for real outreach</h2>
                        <p className="section-subtitle">
                            Everything you need to send at scale — nothing you don&apos;t.
                        </p>
                        <div className="features-grid">
                            <div className="feature-card">
                                <div className="feature-icon"><Upload size={20} /></div>
                                <h3>CSV Variable Substitution</h3>
                                <p>Any column becomes a template variable. Headers are auto-detected — no mapping needed.</p>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon"><Shuffle size={20} /></div>
                                <h3>Spin Syntax</h3>
                                <p>Write <code>{'{Hello|Hi|Hey}'}</code> and each recipient gets a random variant. Every message feels unique.</p>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon"><Shield size={20} /></div>
                                <h3>Anti-Ban Safety</h3>
                                <p>Per-message delays, random jitter, batch cool-downs, and daily limits keep your accounts safe.</p>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon"><BarChart3 size={20} /></div>
                                <h3>Live Progress</h3>
                                <p>Real-time sent / failed / skipped counters. Cancel mid-send at any time.</p>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon"><WifiOff size={20} /></div>
                                <h3>Fully Offline</h3>
                                <p>All data stays on your device. No external servers, no analytics, no tracking.</p>
                            </div>
                            <div className="feature-card">
                                <div className="feature-icon"><SlidersHorizontal size={20} /></div>
                                <h3>Cross-Profile Sync</h3>
                                <p>Settings sync across Chrome profiles automatically. Your preferences follow you.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How it works */}
                <section className="how-it-works" id="how-it-works">
                    <div className="section-inner">
                        <h2 className="section-title">Three steps. That&apos;s it.</h2>
                        <div className="steps-row">
                            <div className="step-card">
                                <div className="step-num">1</div>
                                <div className="step-icon-wrap"><Upload size={24} /></div>
                                <h3>Upload your CSV</h3>
                                <p>Drop a file with email/phone and any personalisation columns.</p>
                            </div>
                            <div className="step-divider">
                                <ArrowRight size={20} />
                            </div>
                            <div className="step-card">
                                <div className="step-num">2</div>
                                <div className="step-icon-wrap"><Mail size={24} /></div>
                                <h3>Write your template</h3>
                                <p>Use <code>{'{{Name}}'}</code>, <code>{'{{Company}}'}</code>, or any column header as a variable.</p>
                            </div>
                            <div className="step-divider">
                                <ArrowRight size={20} />
                            </div>
                            <div className="step-card">
                                <div className="step-num">3</div>
                                <div className="step-icon-wrap"><Zap size={24} /></div>
                                <h3>Hit send</h3>
                                <p>Watch messages go out one by one with live progress and full control.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="final-cta">
                    <div className="section-inner">
                        <div className="cta-card">
                            <Clock size={32} className="cta-icon" />
                            <h2>Ready to send?</h2>
                            <p>No sign-up required. Open the web app or install the extension and start reaching people in minutes.</p>
                            <div className="cta-actions">
                                <Link href="/dashboard" className="btn-hero-primary">
                                    Open Web App
                                </Link>
                                <a
                                    href="https://chromewebstore.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-hero-secondary"
                                >
                                    Chrome Extension
                                </a>
                            </div>
                        </div>
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
                            <Link href="/privacy">Privacy Policy</Link>
                            <a href="https://github.com/mohamed-arabi16/Bulk-Email-sender" target="_blank" rel="noopener noreferrer">
                                Source Code
                            </a>
                            <a href="https://github.com/mohamed-arabi16/Bulk-Email-sender/issues" target="_blank" rel="noopener noreferrer">
                                Support
                            </a>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}
