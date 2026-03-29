'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mail, Chrome, Globe } from 'lucide-react';
import { useTranslation } from '../i18n';

interface MessageDef {
    status: string;
    statusColor: string;
    labelKey: string;
    time?: string;
    sublabelKey?: string;
    pulse?: boolean;
    textKey: string;
    names: { name: string; company?: string };
    varClass: string;
    size: string;
    style: Record<string, string | number>;
}

const messageDefs: MessageDef[] = [
    {
        status: 'sent', statusColor: '#34c759', labelKey: 'heroMessages.sent', time: '12:04 PM',
        textKey: 'heroMessages.msg1', names: { name: 'Alice', company: 'Acme Corp' }, varClass: 'msg-var',
        size: 'lg', style: { top: '8%', left: '8%', transform: 'rotate(-2deg)', zIndex: 6 },
    },
    {
        status: 'sending', statusColor: '#10b981', labelKey: 'heroMessages.sending', pulse: true,
        textKey: 'heroMessages.msg2', names: { name: 'Bob', company: 'Widgets Ltd' }, varClass: 'msg-var',
        size: 'md', style: { top: '28%', right: '8%', transform: 'rotate(3deg)', zIndex: 5 },
    },
    {
        status: 'whatsapp', statusColor: '#25d366', labelKey: 'heroMessages.whatsapp', sublabelKey: 'heroMessages.sent',
        textKey: 'heroMessages.msg3', names: { name: 'Carol' }, varClass: 'msg-var-wa',
        size: 'md', style: { top: '52%', left: '12%', transform: 'rotate(1deg)', zIndex: 4 },
    },
    {
        status: 'sent', statusColor: '#34c759', labelKey: 'heroMessages.sent', time: '12:03 PM',
        textKey: 'heroMessages.msg4', names: { name: 'Dana', company: 'TechConf' }, varClass: 'msg-var',
        size: 'md', style: { top: '6%', right: '20%', transform: 'rotate(-4deg)', zIndex: 3, opacity: 0.55 },
    },
    {
        status: 'queued', statusColor: '#71717a', labelKey: 'heroMessages.queued',
        textKey: 'heroMessages.msg5', names: { name: 'Dave' }, varClass: 'msg-var',
        size: 'sm', style: { top: '38%', left: '28%', transform: 'rotate(-3deg)', zIndex: 2, opacity: 0.45 },
    },
    {
        status: 'queued', statusColor: '#71717a', labelKey: 'heroMessages.queued',
        textKey: 'heroMessages.msg6', names: { name: 'Eve' }, varClass: 'msg-var',
        size: 'sm', style: { bottom: '18%', right: '14%', transform: 'rotate(5deg)', zIndex: 1, opacity: 0.35 },
    },
    {
        status: 'queued', statusColor: '#71717a', labelKey: 'heroMessages.queued',
        textKey: 'heroMessages.msg7', names: { name: 'Frank' }, varClass: 'msg-var',
        size: 'xs', style: { bottom: '10%', left: '18%', transform: 'rotate(-5deg)', zIndex: 0, opacity: 0.2 },
    },
];

function renderMessageText(template: string, names: { name: string; company?: string }, varClass: string) {
    const parts: (string | React.JSX.Element)[] = [];
    let remaining = template;
    let key = 0;
    const replacements = [
        { token: '{{name}}', value: names.name },
        { token: '{{company}}', value: names.company },
    ];
    while (remaining.length > 0) {
        let earliest = -1;
        let earliestRepl: typeof replacements[0] | null = null;
        for (const r of replacements) {
            if (!r.value) continue;
            const idx = remaining.indexOf(r.token);
            if (idx !== -1 && (earliest === -1 || idx < earliest)) {
                earliest = idx;
                earliestRepl = r;
            }
        }
        if (earliest === -1 || !earliestRepl) {
            parts.push(remaining);
            break;
        }
        if (earliest > 0) parts.push(remaining.slice(0, earliest));
        parts.push(<span key={key++} className={varClass}>{earliestRepl.value}</span>);
        remaining = remaining.slice(earliest + earliestRepl.token.length);
    }
    return parts;
}

export default function HeroSection() {
    const [visible, setVisible] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        const timer = setTimeout(() => setVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    return (
        <section className="hero-split">
            <div className={`hero-text ${visible ? 'hero-text--visible' : ''}`}>
                <div className="hero-badges">
                    <span className="hero-badge" style={{ transitionDelay: '0.1s' }}>
                        <Globe size={14} /> {t('hero.badgeWeb')}
                    </span>
                    <span className="hero-badge" style={{ transitionDelay: '0.2s' }}>
                        <Chrome size={14} /> {t('hero.badgeExtension')}
                    </span>
                </div>
                <h1 className="hero-title">
                    {t('hero.titleLine1')}<br />
                    <span className="hero-accent">{t('hero.titleLine2')}</span>
                </h1>
                <p className="hero-subtitle">{t('hero.subtitle')}</p>
                <div className="hero-actions">
                    <Link href="/dashboard" className="btn-hero-primary">
                        <Mail size={18} />
                        {t('hero.openWebApp')}
                    </Link>
                    <a
                        href="https://chromewebstore.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-hero-secondary"
                    >
                        <Chrome size={18} />
                        {t('hero.getExtension')}
                    </a>
                </div>
            </div>

            <div className={`hero-visual ${visible ? 'hero-visual--visible' : ''}`}>
                <div className="hero-glow" />
                {messageDefs.map((msg, i) => (
                    <div
                        key={i}
                        className={`msg-card msg-card--${msg.size} float-${i}`}
                        style={{
                            ...msg.style,
                            animationDelay: `${i * 0.12}s`,
                            transitionDelay: `${0.2 + i * 0.08}s`,
                        }}
                    >
                        <div className="msg-status">
                            <span
                                className={`msg-dot ${msg.pulse ? 'msg-dot--pulse' : ''}`}
                                style={{ background: msg.statusColor }}
                            />
                            <span className="msg-label" style={{ color: msg.statusColor }}>
                                {t(msg.labelKey)}
                            </span>
                            {msg.time && <span className="msg-time">{msg.time}</span>}
                            {msg.sublabelKey && <span className="msg-time">{t(msg.sublabelKey)}</span>}
                        </div>
                        <div className="msg-body">
                            {renderMessageText(t(msg.textKey), msg.names, msg.varClass)}
                        </div>
                    </div>
                ))}

                <div className="hero-stats-pill" style={{ transitionDelay: '0.9s' }}>
                    <span className="stats-sent">{t('hero.statsSent')}</span>
                    <span className="stats-sending">{t('hero.statsSending')}</span>
                    <span className="stats-queued">{t('hero.statsQueued')}</span>
                </div>
            </div>
        </section>
    );
}
