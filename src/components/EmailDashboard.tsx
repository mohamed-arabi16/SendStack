'use client';

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Papa from 'papaparse';
import {
    Upload, FileText, Send, Settings, CheckCircle, AlertCircle,
    RefreshCw, Eye, ChevronLeft, ChevronRight, Clock, Zap, Mail, ArrowRight, MessageCircle, Phone,
    Paperclip, Calendar, X
} from 'lucide-react';
import { resolveSpin, applyJitter } from '@/lib/whatsapp-utils';

type CSVRow = Record<string, string>;
type LogEntry = {
    email: string;
    status: 'success' | 'error' | 'info';
    message?: string;
    errorType?: string;
    /** WhatsApp message ID — used to track ACK status */
    messageId?: string;
};
type WAStatus = 'disconnected' | 'reconnecting' | 'qr' | 'ready';
/** ACK level: 0=Pending 1=Sent 2=Delivered 3=Read */
type AckLevel = 0 | 1 | 2 | 3;

/** Milliseconds for each WhatsApp delay preset */
const WA_DELAY_PRESETS = { fast: 5000, normal: 10000, safe: 15000 } as const;

/** Max seconds to wait for WhatsApp reconnection during a mid-send disconnect */
const MAX_RECONNECT_WAIT_SECONDS = 120;

/** Maximum additional delay imposed when rate-limiting is detected (ms) */
const MAX_RATE_LIMIT_PENALTY_MS = 60000;

/** Delay increment per rate-limit hit (ms) */
const RATE_LIMIT_INCREMENT_MS = 10000;

/** Allowed MIME types for media attachment */
const ALLOWED_MEDIA_TYPES: Record<string, string> = {
    'image/png': 'PNG', 'image/jpeg': 'JPG', 'image/gif': 'GIF', 'image/webp': 'WebP',
    'application/pdf': 'PDF',
    'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.ms-excel': 'XLS',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
};
const MAX_MEDIA_BYTES = 16 * 1024 * 1024; // 16 MB

/** Human-readable ACK icon + label */
const ACK_DISPLAY: Record<AckLevel, { icon: string; label: string; color: string }> = {
    0: { icon: '⏳', label: 'Pending', color: 'var(--text-tertiary)' },
    1: { icon: '✓', label: 'Sent', color: 'var(--text-secondary)' },
    2: { icon: '✓✓', label: 'Delivered', color: 'var(--text-secondary)' },
    3: { icon: '✓✓', label: 'Read', color: '#4ade80' },
};

export default function EmailDashboard() {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [data, setData] = useState<CSVRow[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [mapping, setMapping] = useState({ name: '', email: '', phone: '' });
    const [mode, setMode] = useState<'email' | 'whatsapp'>('email');
    const [emailContent, setEmailContent] = useState({ subject: '', body: '' });
    const [isRTL, setIsRTL] = useState(true); // Default to RTL for Arabic users
    const [smtpConfig, setSmtpConfig] = useState({
        host: 'smtp.mail.me.com',
        port: '587',
        secure: false,
        user: '',
        pass: '',
        fromName: 'StudyBuddy',
        fromEmail: 'studybuddy@qobouli.com',
    });
    const [sendingStatus, setSendingStatus] = useState<'idle' | 'sending' | 'completed'>('idle');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [currentProgress, setCurrentProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [previewRow, setPreviewRow] = useState(0);
    const [showPreview, setShowPreview] = useState(false);
    const [sendDelay, setSendDelay] = useState(2); // seconds between emails
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- WhatsApp Anti-Ban Settings (Phase 2) ---
    const [waDelayPreset, setWaDelayPreset] = useState<'fast' | 'normal' | 'safe' | 'custom'>('normal');
    const [waCustomDelay, setWaCustomDelay] = useState(10);
    const [waJitter, setWaJitter] = useState(true);
    const [waSpinEnabled, setWaSpinEnabled] = useState(true);
    const [waBatchSize, setWaBatchSize] = useState(10);
    const [waCoolDown, setWaCoolDown] = useState(60);
    const [waDailyLimit, setWaDailyLimit] = useState(200);
    // WhatsApp runtime state
    const [waCoolDownActive, setWaCoolDownActive] = useState(false);
    const [waCoolDownRemaining, setWaCoolDownRemaining] = useState(0);
    const [waValidationResults, setWaValidationResults] = useState<{ phone: string; valid: boolean }[]>([]);
    const [waValidating, setWaValidating] = useState(false);
    const [waDailyCount, setWaDailyCount] = useState(0);
    const [waLimitOverridden, setWaLimitOverridden] = useState(false);
    const [waStatus, setWaStatus] = useState<WAStatus>('disconnected');
    const [waQR, setWaQR] = useState<string | null>(null);
    const [waConnecting, setWaConnecting] = useState(false);
    const [waInitError, setWaInitError] = useState<string | null>(null);
    // Task 18 — mid-send disconnect / rate-limit state
    const [waReconnectPrompt, setWaReconnectPrompt] = useState(false);
    const [waEffectiveDelay, setWaEffectiveDelay] = useState<number | null>(null); // override when rate-limited
    // Task 19 — Media attachment
    const [waMediaFile, setWaMediaFile] = useState<File | null>(null);
    const [waMediaBase64, setWaMediaBase64] = useState<string | null>(null);
    const waMediaInputRef = useRef<HTMLInputElement>(null);
    // Task 20 — ACK status tracking
    const [waAckMap, setWaAckMap] = useState<Record<string, AckLevel>>({});
    // Task 21 — Scheduled sending
    const [waScheduleEnabled, setWaScheduleEnabled] = useState(false);
    const [waScheduledTime, setWaScheduledTime] = useState('');
    const [waScheduleCountdown, setWaScheduleCountdown] = useState<string | null>(null);

    // Load/sync daily WhatsApp send count from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem('wa_daily_send');
            if (stored) {
                const { count, date } = JSON.parse(stored) as { count: number; date: string };
                if (date === new Date().toDateString()) {
                    setWaDailyCount(count);
                } else {
                    localStorage.setItem('wa_daily_send', JSON.stringify({ count: 0, date: new Date().toDateString() }));
                }
            }
        } catch { /* ignore */ }
    }, []);

    // Poll WhatsApp connection status when in WhatsApp mode
    useEffect(() => {
        if (mode !== 'whatsapp') return;
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/whatsapp/status');
                if (res.ok) {
                    const json = await res.json() as { status: WAStatus; error?: string };
                    setWaStatus(json.status);
                    setWaInitError(json.error ?? null);
                }
            } catch { /* ignore */ }
        };
        fetchStatus();
        const id = setInterval(fetchStatus, 3000);
        return () => clearInterval(id);
    }, [mode]);

    // Poll WhatsApp QR code when status is 'qr' (Phase 3, Task 14)
    useEffect(() => {
        if (mode !== 'whatsapp' || waStatus !== 'qr') {
            setWaQR(null);
            return;
        }
        const fetchQR = async () => {
            try {
                const res = await fetch('/api/whatsapp/qr');
                if (res.ok) {
                    const json = await res.json() as { qr: string | null; status: string };
                    setWaQR(json.qr);
                }
            } catch { /* ignore */ }
        };
        fetchQR();
        const id = setInterval(fetchQR, 3000);
        return () => clearInterval(id);
    }, [mode, waStatus]);

    // Task 20 — Poll ACK status while a send is in progress
    useEffect(() => {
        if (sendingStatus !== 'sending' || mode !== 'whatsapp') return;
        const poll = async () => {
            try {
                const res = await fetch('/api/whatsapp/ack');
                if (res.ok) {
                    const json = await res.json() as { acks: Record<string, AckLevel> };
                    setWaAckMap(prev => ({ ...prev, ...json.acks }));
                }
            } catch { /* ignore */ }
        };
        const id = setInterval(poll, 5000);
        return () => clearInterval(id);
    }, [sendingStatus, mode]);

    // Task 21 — Countdown timer for scheduled send
    useEffect(() => {
        if (!waScheduleEnabled || !waScheduledTime) {
            setWaScheduleCountdown(null);
            return;
        }
        const tick = () => {
            const diff = new Date(waScheduledTime).getTime() - Date.now();
            if (diff <= 0) {
                setWaScheduleCountdown('Now');
                return;
            }
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setWaScheduleCountdown(
                h > 0
                    ? `${h}h ${m}m ${s}s`
                    : m > 0
                    ? `${m}m ${s}s`
                    : `${s}s`,
            );
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [waScheduleEnabled, waScheduledTime]);

    // --- CSV Parsing ---
    const parseCSV = useCallback((uploadedFile: File) => {
        setFile(uploadedFile);
        Papa.parse(uploadedFile, {
            header: true,
            skipEmptyLines: true,
            encoding: 'UTF-8',
            complete: (results) => {
                const parsedData = results.data as CSVRow[];
                const cleanHeaders = results.meta.fields?.map(h => h.replace(/^\uFEFF/, '').trim()) || [];
                setData(parsedData);
                setHeaders(cleanHeaders);
                setStep(2);
            },
        });
    }, []);

    // --- Drag & Drop ---
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.name.endsWith('.csv')) {
            parseCSV(droppedFile);
        }
    }, [parseCSV]);

    const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const uploadedFile = e.target.files?.[0];
        if (uploadedFile) parseCSV(uploadedFile);
    }, [parseCSV]);

    // --- Template Variable System ---
    const renderTemplate = useCallback((template: string, row: CSVRow): string => {
        return template.replace(/\{\{(.+?)\}\}/g, (match, varName) => {
            const trimmed = varName.trim();
            // Try exact match first, then case-insensitive
            if (row[trimmed] !== undefined) return row[trimmed];
            const key = Object.keys(row).find(k => k.trim().toLowerCase() === trimmed.toLowerCase());
            return key ? row[key] : match;
        });
    }, []);

    // --- WhatsApp Helpers (Phase 2) ---
    /** Return base delay in ms based on the selected preset */
    const getWABaseDelay = useCallback((): number => {
        return waDelayPreset === 'custom' ? waCustomDelay * 1000 : WA_DELAY_PRESETS[waDelayPreset];
    }, [waDelayPreset, waCustomDelay]);

    /** Persist the incremented daily count to localStorage */
    const incrementDailyCount = useCallback((n: number) => {
        setWaDailyCount(prev => {
            const next = prev + n;
            try {
                localStorage.setItem('wa_daily_send', JSON.stringify({ count: next, date: new Date().toDateString() }));
            } catch { /* ignore */ }
            return next;
        });
    }, []);

    // Task 19 — handle media file selection
    const handleMediaFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!ALLOWED_MEDIA_TYPES[f.type]) {
            alert(`Unsupported file type. Allowed: ${Object.values(ALLOWED_MEDIA_TYPES).join(', ')}`);
            return;
        }
        if (f.size > MAX_MEDIA_BYTES) {
            alert('File too large. Maximum size is 16 MB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // result is "data:<mime>;base64,<data>" — extract only the base64 part
            const base64 = result.split(',')[1];
            setWaMediaFile(f);
            setWaMediaBase64(base64);
        };
        reader.readAsDataURL(f);
    }, []);

    const handleClearMedia = useCallback(() => {
        setWaMediaFile(null);
        setWaMediaBase64(null);
        if (waMediaInputRef.current) waMediaInputRef.current.value = '';
    }, []);

    // Task 21 — return min datetime string for the schedule picker (current time + 1 min)
    const scheduleMinTime = useMemo(() => {
        const d = new Date(Date.now() + 60000);
        d.setSeconds(0, 0);
        return d.toISOString().slice(0, 16);
    }, []);

    // Detect variables used in template
    const detectedVars = useMemo(() => {
        const combined = emailContent.subject + ' ' + emailContent.body;
        const matches = combined.match(/\{\{(.+?)\}\}/g);
        if (!matches) return [];
        return [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
    }, [emailContent.subject, emailContent.body]);

    // Preview data
    const previewData = useMemo(() => {
        if (data.length === 0) return { subject: emailContent.subject, body: emailContent.body };
        const row = data[previewRow] || data[0];
        return {
            subject: renderTemplate(emailContent.subject, row),
            body: renderTemplate(emailContent.body, row),
            recipientName: mapping.name ? row[mapping.name] : '',
            recipientEmail: mapping.email ? row[mapping.email] : '',
        };
    }, [data, previewRow, emailContent, mapping, renderTemplate]);

    // --- Send Emails ---
    const handleSendEmails = async () => {
        setSendingStatus('sending');
        setLogs([]);
        setCurrentProgress(0);

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const recipientEmail = row[mapping.email];

            if (!recipientEmail || !recipientEmail.includes('@')) {
                setLogs(prev => [...prev, { email: recipientEmail || 'Unknown', status: 'error', message: 'Invalid or missing email' }]);
                setCurrentProgress(((i + 1) / data.length) * 100);
                continue;
            }

            const personalizedSubject = renderTemplate(emailContent.subject, row);
            let personalizedBody = renderTemplate(emailContent.body, row);

            // Wrap in RTL div if enabled
            if (isRTL) {
                personalizedBody = `
                    <div dir="rtl" style="text-align: right; direction: rtl; font-family: 'Arial', sans-serif;">
                        ${personalizedBody}
                    </div>
                `;
            }

            try {
                const res = await fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: recipientEmail.trim(),
                        subject: personalizedSubject,
                        html: personalizedBody,
                        smtpConfig: {
                            host: smtpConfig.host,
                            port: Number(smtpConfig.port),
                            secure: smtpConfig.secure,
                            user: smtpConfig.user.trim(),
                            pass: smtpConfig.pass,
                            fromName: smtpConfig.fromName,
                        },
                        fromEmail: smtpConfig.fromEmail.trim() || smtpConfig.user.trim(),
                    }),
                });

                const result = await res.json();

                if (result.success) {
                    setLogs(prev => [...prev, { email: recipientEmail, status: 'success' }]);
                } else {
                    let friendlyMsg = result.error;
                    if (result.errorType === 'auth') {
                        friendlyMsg = 'Authentication failed. Check your SMTP username (must be @icloud.com) and app password.';
                    } else if (result.errorType === 'ratelimit') {
                        friendlyMsg = 'Rate limited by server. Try increasing the delay between emails.';
                    }
                    setLogs(prev => [...prev, { email: recipientEmail, status: 'error', message: friendlyMsg, errorType: result.errorType }]);

                    // If auth error, stop sending — no point continuing
                    if (result.errorType === 'auth') {
                        setSendingStatus('completed');
                        setCurrentProgress(100);
                        return;
                    }
                }
            } catch {
                setLogs(prev => [...prev, { email: recipientEmail, status: 'error', message: 'Network error — check your connection' }]);
            }

            setCurrentProgress(((i + 1) / data.length) * 100);

            // Rate limiting delay between sends
            if (i < data.length - 1 && sendDelay > 0) {
                await new Promise(resolve => setTimeout(resolve, sendDelay * 1000));
            }
        }
        setSendingStatus('completed');
    };

    // --- Validate WhatsApp Numbers (Phase 2, Task 13) ---
    const handleValidateNumbers = async () => {
        setWaValidating(true);
        setWaValidationResults([]);
        const phones = data
            .map(row => row[mapping.phone])
            .filter(Boolean)
            .map(p => p.replace(/[\s\-\(\)\+]/g, ''));

        try {
            const res = await fetch('/api/whatsapp/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phones }),
            });
            const result = await res.json() as { success: boolean; results?: { phone: string; valid: boolean }[] };
            if (result.success && result.results) {
                setWaValidationResults(result.results);
            }
        } catch { /* ignore */ } finally {
            setWaValidating(false);
        }
    };

    // --- WhatsApp Connect / Disconnect (Phase 3, Task 14) ---
    const handleConnectWhatsApp = useCallback(async () => {
        setWaConnecting(true);
        setWaInitError(null);
        try {
            await fetch('/api/whatsapp/init', { method: 'POST' });
        } catch { /* ignore */ } finally {
            setWaConnecting(false);
        }
    }, []);

    const handleDisconnectWhatsApp = useCallback(async () => {
        try {
            const res = await fetch('/api/whatsapp/disconnect', { method: 'POST' });
            if (res.ok) {
                setWaStatus('disconnected');
                setWaQR(null);
            }
        } catch { /* ignore */ }
    }, []);

    // --- Send WhatsApp ---
    const handleSendWhatsApp = async () => {
        // Task 21 — If scheduled, wait until the target time
        if (waScheduleEnabled && waScheduledTime) {
            const target = new Date(waScheduledTime).getTime();
            const now = Date.now();
            if (target > now) {
                // Wait until scheduled time
                await new Promise(r => setTimeout(r, target - now));
            }
        }

        // Check daily limit (Task 12)
        const dailyRemaining = waDailyLimit - waDailyCount;
        if (!waLimitOverridden && dailyRemaining <= 0) {
            alert('Daily sending limit reached. Override the limit in the settings to continue.');
            return;
        }

        setSendingStatus('sending');
        setLogs([]);
        setCurrentProgress(0);
        setWaReconnectPrompt(false);
        setWaEffectiveDelay(null);
        let sentCount = 0;
        // Track rate-limit hits to progressively increase delay
        let rateLimitHits = 0;

        for (let i = 0; i < data.length; i++) {
            // Task 18 — Pause if client disconnected mid-send
            if (waStatus !== 'ready') {
                setWaReconnectPrompt(true);
                setLogs(prev => [...prev, { email: '⚠️', status: 'info', message: 'WhatsApp disconnected mid-send. Reconnect and the batch will resume…' }]);
                // Wait up to 2 minutes for reconnection
                let waited = 0;
                let reconnected = false;
                while (waited < MAX_RECONNECT_WAIT_SECONDS) {
                    await new Promise(r => setTimeout(r, 3000));
                    waited += 3;
                    const res = await fetch('/api/whatsapp/status').catch(() => null);
                    if (res?.ok) {
                        const json = await res.json() as { status: WAStatus };
                        setWaStatus(json.status);
                        if (json.status === 'ready') {
                            setWaReconnectPrompt(false);
                            reconnected = true;
                            break;
                        }
                    }
                }
                if (!reconnected) {
                    setLogs(prev => [...prev, { email: '🛑', status: 'error', message: 'Could not reconnect — send aborted.' }]);
                    break;
                }
            }

            const row = data[i];
            const rawPhone = row[mapping.phone];
            const name = mapping.name ? row[mapping.name] : 'Recipient';

            if (!rawPhone) {
                setLogs(prev => [...prev, { email: `${name} (No Phone)`, status: 'error', message: 'Missing phone number' }]);
                setCurrentProgress(((i + 1) / data.length) * 100);
                continue;
            }

            const phone = rawPhone.replace(/[\s\-\(\)\+]/g, '');

            // Task 18 — Phone number format validation
            if (!/^\d{7,15}$/.test(phone)) {
                setLogs(prev => [...prev, { email: `${name} (${rawPhone})`, status: 'error', message: 'Invalid phone number format — skipped', errorType: 'invalid_phone' }]);
                setCurrentProgress(((i + 1) / data.length) * 100);
                continue;
            }

            // Skip numbers marked invalid by pre-send validation (Task 13)
            if (waValidationResults.length > 0) {
                const vr = waValidationResults.find(r => r.phone === phone);
                if (vr && !vr.valid) {
                    setLogs(prev => [...prev, { email: `${name} (${phone})`, status: 'error', message: 'Not on WhatsApp — skipped' }]);
                    setCurrentProgress(((i + 1) / data.length) * 100);
                    continue;
                }
            }

            // Enforce daily limit mid-loop (Task 12)
            if (!waLimitOverridden && waDailyCount + sentCount >= waDailyLimit) {
                setLogs(prev => [...prev, { email: `${name} (${phone})`, status: 'error', message: 'Daily limit reached — skipped' }]);
                setCurrentProgress(((i + 1) / data.length) * 100);
                continue;
            }

            // Resolve template variables, then spin syntax if enabled (Tasks 9, 10)
            let message = renderTemplate(emailContent.body, row);
            if (waSpinEnabled) {
                message = resolveSpin(message);
            }

            try {
                let messageId: string | undefined;

                // Task 19 — Send media if attached, otherwise send text
                if (waMediaBase64 && waMediaFile) {
                    const res = await fetch('/api/whatsapp/send-media', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            phone,
                            mediaBase64: waMediaBase64,
                            mimeType: waMediaFile.type,
                            filename: waMediaFile.name,
                            caption: message,
                        }),
                    });
                    const result = await res.json() as { success: boolean; messageId?: string; error?: string; errorType?: string };
                    if (!result.success) throw Object.assign(new Error(result.error ?? 'Send failed'), { errorType: result.errorType });
                    messageId = result.messageId;
                } else {
                    const res = await fetch('/api/whatsapp/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone, message }),
                    });
                    const result = await res.json() as { success: boolean; messageId?: string; error?: string; errorType?: string };
                    if (!result.success) throw Object.assign(new Error(result.error ?? 'Send failed'), { errorType: result.errorType });
                    messageId = result.messageId;
                }

                sentCount++;
                // Task 20 — seed the ACK map with pending status
                if (messageId) {
                    const id = messageId;
                    setWaAckMap(prev => ({ ...prev, [id]: 0 }));
                }
                setLogs(prev => [...prev, {
                    email: `${name} (${phone})`,
                    status: 'success',
                    message: `Sent — "${message.slice(0, 60)}${message.length > 60 ? '…' : ''}"`,
                    messageId,
                }]);

                // Reset rate-limit counter on success
                if (rateLimitHits > 0) rateLimitHits = 0;

            } catch (err: unknown) {
                const errMessage = err instanceof Error ? err.message : 'Unknown error';
                const errType = (err as { errorType?: string }).errorType;

                // Task 18 — Handle specific error types
                if (errType === 'disconnected') {
                    setWaReconnectPrompt(true);
                }
                if (errType === 'rate_limited') {
                    rateLimitHits++;
                    const penalty = Math.min(MAX_RATE_LIMIT_PENALTY_MS, getWABaseDelay() + rateLimitHits * RATE_LIMIT_INCREMENT_MS);
                    setWaEffectiveDelay(penalty);
                    setLogs(prev => [...prev, { email: '⚡', status: 'info', message: `Rate limit detected — increasing delay to ${(penalty / 1000).toFixed(0)}s` }]);
                }

                setLogs(prev => [...prev, { email: `${name} (${phone})`, status: 'error', message: errMessage, errorType: errType }]);
            }

            setCurrentProgress(((i + 1) / data.length) * 100);

            if (i < data.length - 1) {
                // Batch cool-down pause (Task 11): trigger after every batchSize *sent* messages
                if (sentCount > 0 && sentCount % waBatchSize === 0) {
                    setWaCoolDownActive(true);
                    let cd = waCoolDown;
                    setWaCoolDownRemaining(cd);
                    setLogs(prev => [...prev, { email: '⏸', status: 'info', message: `Batch of ${waBatchSize} sent — cooling down for ${waCoolDown}s…` }]);
                    while (cd > 0) {
                        await new Promise(r => setTimeout(r, 1000));
                        cd--;
                        setWaCoolDownRemaining(cd);
                    }
                    setWaCoolDownActive(false);
                } else {
                    // Regular delay with optional jitter (Tasks 8 & 9)
                    // Use overridden delay when rate-limited (Task 18)
                    const baseMs = waEffectiveDelay ?? getWABaseDelay();
                    const actualMs = waJitter ? applyJitter(baseMs) : baseMs;
                    const actualSec = (actualMs / 1000).toFixed(1);
                    setLogs(prev => [...prev, { email: '⏳', status: 'info', message: `Waiting ${actualSec}s before next message…` }]);
                    await new Promise(r => setTimeout(r, actualMs));
                }
            }
        }

        // Persist daily count (Task 12)
        incrementDailyCount(sentCount);
        setSendingStatus('completed');
    };

    // --- Stats ---
    const successCount = logs.filter(l => l.status === 'success').length;
    const errorCount = logs.filter(l => l.status === 'error').length;

    /** 80 % threshold for the daily-limit warning */
    const waDailyWarningThreshold = useMemo(() => Math.floor(waDailyLimit * 0.8), [waDailyLimit]);

    const stepLabels = ['Upload', 'Map Columns', 'Compose', 'Send'];

    return (
        <div className="dashboard-container">
            {/* Header */}
            <div className="dashboard-header">
                <div className="header-icon">
                    <svg width="28" height="28" viewBox="0 0 72 72" fill="none">
                        <path d="M36 12L60 24L36 36L12 24L36 12Z" fill="#10b981" opacity="0.9"/>
                        <path d="M60 32L36 44L12 32" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M60 42L36 54L12 42" stroke="#6ee7b7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
                <div>
                    <h1 className="header-title">Send<span style={{ color: 'var(--accent)' }}>Stack</span></h1>
                    <p className="header-subtitle">Upload CSV · Personalize · Send</p>
                </div>
                <div className="ml-auto flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setMode('email')}
                        className={`px-3 py-1 text-sm rounded-md transition-all ${mode === 'email' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Email
                    </button>
                    <button
                        onClick={() => setMode('whatsapp')}
                        className={`px-3 py-1 text-sm rounded-md transition-all ${mode === 'whatsapp' ? 'bg-white shadow text-green-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        WhatsApp
                    </button>
                </div>
            </div>

            {/* Steps Navigation */}
            <div className="steps-nav">
                {stepLabels.map((label, idx) => {
                    const s = idx + 1;
                    const isActive = step === s;
                    const isCompleted = step > s;
                    return (
                        <React.Fragment key={s}>
                            <button
                                onClick={() => { if (isCompleted) setStep(s); }}
                                className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                                disabled={!isCompleted && !isActive}
                            >
                                <div className={`step-number ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : s}
                                </div>
                                <span className="step-label">{label}</span>
                            </button>
                            {idx < stepLabels.length - 1 && (
                                <div className={`step-connector ${isCompleted ? 'completed' : ''}`} />
                            )}
                        </React.Fragment>
                    );
                })}
            </div>

            {/* WhatsApp Connection Panel (Phase 3, Task 14) */}
            {mode === 'whatsapp' && (
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <h3 className="card-title" style={{ marginBottom: 0 }}>
                            <MessageCircle className="w-4 h-4" /> WhatsApp Connection
                        </h3>
                        {waStatus === 'ready' && (
                            <span style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '3px 12px', fontSize: 13, fontWeight: 500 }}>
                                ✅ WhatsApp Connected
                            </span>
                        )}
                        {waStatus === 'qr' && (
                            <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '3px 12px', fontSize: 13 }}>
                                📱 Scan QR Code
                            </span>
                        )}
                        {waStatus === 'reconnecting' && (
                            <span style={{ background: 'var(--amber-bg)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '3px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <RefreshCw className="w-3 h-3 animate-spin" /> Reconnecting…
                            </span>
                        )}
                        {waStatus === 'disconnected' && (
                            <span style={{ background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', padding: '3px 12px', fontSize: 13 }}>
                                ⚫ Disconnected
                            </span>
                        )}
                    </div>

                    {waStatus === 'disconnected' && (
                        <>
                            <button
                                onClick={handleConnectWhatsApp}
                                disabled={waConnecting}
                                className="btn-primary"
                                style={{ marginTop: 12 }}
                            >
                                {waConnecting
                                    ? <RefreshCw className="w-4 h-4 animate-spin" />
                                    : <MessageCircle className="w-4 h-4" />
                                }
                                {waConnecting ? 'Connecting…' : 'Connect WhatsApp'}
                            </button>
                            {waInitError && (
                                <p style={{ fontSize: 12, color: 'var(--red)', marginTop: 8, wordBreak: 'break-word' }}>
                                    ⚠️ {waInitError}
                                </p>
                            )}
                        </>
                    )}

                    {waStatus === 'reconnecting' && (
                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>
                            A saved session was found — reconnecting automatically. This may take up to 30 seconds.
                        </p>
                    )}

                    {waStatus === 'qr' && (
                        <div style={{ marginTop: 12, textAlign: 'center' }}>
                            {waQR ? (
                                <>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                        Open WhatsApp on your phone → Menu → Linked Devices → Link a Device
                                    </p>
                                    <Image
                                        src={waQR}
                                        alt="Scan this QR code with WhatsApp mobile app to link your device"
                                        width={220}
                                        height={220}
                                        unoptimized
                                        style={{ border: '1px solid var(--border-light)', borderRadius: 8, margin: '0 auto', display: 'block' }}
                                    />
                                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                                        QR code auto-refreshes every 3 seconds
                                    </p>
                                </>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '16px 0' }}>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading QR code…</span>
                                </div>
                            )}
                        </div>
                    )}

                    {waStatus === 'ready' && (
                        <button
                            onClick={handleDisconnectWhatsApp}
                            className="btn-secondary"
                            style={{ marginTop: 12 }}
                        >
                            Disconnect
                        </button>
                    )}
                </div>
            )}

            {/* Step 1: Upload */}
            {step === 1 && (
                <div
                    className={`upload-zone ${isDragging ? 'dragging' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="upload-icon-wrapper">
                        <Upload className="w-10 h-10" />
                    </div>
                    <h2 className="upload-title">
                        {isDragging ? 'Drop your file here' : 'Drop your CSV file here'}
                    </h2>
                    <p className="upload-subtitle">or click to browse · Supports Arabic & English headers</p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileInput}
                        className="hidden"
                    />
                    <div className="upload-formats">
                        <span className="format-badge">.CSV</span>
                        <span className="format-badge">UTF-8</span>
                        <span className="format-badge">عربي</span>
                    </div>
                </div>
            )}

            {/* Step 2: Map Columns */}
            {step === 2 && (
                <div className="step-content">
                    <div className="info-banner">
                        <FileText className="w-5 h-5 flex-shrink-0" />
                        <div>
                            <h3 className="info-title">{file?.name}</h3>
                            <p className="info-text">{data.length} rows · {headers.length} columns detected</p>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="card-title">Column Mapping</h3>
                        <div className="mapping-grid">
                            <div className="field-group">
                                <label className="field-label">
                                    {mode === 'email' ? 'Email Column' : 'Phone Number Column'} <span className="required">*</span>
                                </label>
                                <select
                                    className="field-select"
                                    value={mode === 'email' ? mapping.email : mapping.phone}
                                    onChange={e => setMapping({ ...mapping, [mode === 'email' ? 'email' : 'phone']: e.target.value })}
                                >
                                    <option value="">— Select Column —</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                            <div className="field-group">
                                <label className="field-label">Name Column (optional)</label>
                                <select
                                    className="field-select"
                                    value={mapping.name}
                                    onChange={e => setMapping({ ...mapping, name: e.target.value })}
                                >
                                    <option value="">— Select Column —</option>
                                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="card-title">Data Preview</h3>
                        <div className="table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        {headers.map((h, i) => (
                                            <th key={i}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.slice(0, 5).map((row, i) => (
                                        <tr key={i}>
                                            {headers.map((h, j) => (
                                                <td key={j}>{row[h] || '—'}</td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="table-footer">Showing first {Math.min(5, data.length)} of {data.length} rows</p>
                    </div>

                    <button
                        onClick={() => setStep(3)}
                        disabled={mode === 'email' ? !mapping.email : !mapping.phone}
                        className="btn-primary"
                    >
                        Continue to Compose <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Step 3: Compose & Config */}
            {step === 3 && (
                <div className="step-content">
                    {/* SMTP Config - Only show for Email */}
                    {mode === 'email' && (
                        <div className="card">
                            <h3 className="card-title">
                                <Settings className="w-4 h-4" /> SMTP Configuration
                            </h3>

                            <div className="field-group">
                                <label className="field-label">Email Provider</label>
                                <select
                                    className="field-select"
                                    value={smtpConfig.host === 'smtp.mail.me.com' ? 'icloud' : smtpConfig.host === 'smtp.gmail.com' ? 'gmail' : 'custom'}
                                    onChange={e => {
                                        if (e.target.value === 'icloud') {
                                            setSmtpConfig({ ...smtpConfig, host: 'smtp.mail.me.com', port: '587', secure: false });
                                        } else if (e.target.value === 'gmail') {
                                            setSmtpConfig({ ...smtpConfig, host: 'smtp.gmail.com', port: '587', secure: false });
                                        }
                                    }}
                                >
                                    <option value="icloud">iCloud Mail</option>
                                    <option value="gmail">Gmail</option>
                                    <option value="custom">Custom SMTP</option>
                                </select>
                            </div>

                            <div className="smtp-grid">
                                <div className="field-group">
                                    <label className="field-label">SMTP Host</label>
                                    <input
                                        type="text"
                                        placeholder="smtp.mail.me.com"
                                        value={smtpConfig.host}
                                        onChange={e => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                                        className="field-input"
                                    />
                                </div>
                                <div className="field-group">
                                    <label className="field-label">Port</label>
                                    <input
                                        type="number"
                                        placeholder="587"
                                        value={smtpConfig.port}
                                        onChange={e => setSmtpConfig({ ...smtpConfig, port: e.target.value })}
                                        className="field-input"
                                    />
                                </div>
                            </div>

                            <div className="smtp-grid">
                                <div className="field-group">
                                    <label className="field-label">
                                        SMTP Username (Login) <span className="required">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="yourname@icloud.com"
                                        value={smtpConfig.user}
                                        onChange={e => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                                        className="field-input"
                                    />
                                    {smtpConfig.host === 'smtp.mail.me.com' && smtpConfig.user && !smtpConfig.user.match(/@(icloud|me|mac)\.com$/) && (
                                        <p className="field-warning">⚠️ iCloud SMTP requires your @icloud.com address for login, not your Apple ID or custom domain</p>
                                    )}
                                </div>
                                <div className="field-group">
                                    <label className="field-label">Sender Email (From Address)</label>
                                    <input
                                        type="text"
                                        placeholder="studybuddy@qobouli.com"
                                        value={smtpConfig.fromEmail}
                                        onChange={e => setSmtpConfig({ ...smtpConfig, fromEmail: e.target.value })}
                                        className="field-input"
                                    />
                                    <p className="field-hint">The address recipients will see. Can be your custom domain alias.</p>
                                </div>
                            </div>

                            <div className="field-group">
                                <label className="field-label">
                                    App-Specific Password <span className="required">*</span>
                                </label>
                                <input
                                    type="password"
                                    placeholder="xxxx-xxxx-xxxx-xxxx"
                                    value={smtpConfig.pass}
                                    onChange={e => setSmtpConfig({ ...smtpConfig, pass: e.target.value })}
                                    className="field-input"
                                />
                            </div>

                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={smtpConfig.secure}
                                    onChange={e => setSmtpConfig({ ...smtpConfig, secure: e.target.checked })}
                                    className="checkbox-input"
                                />
                                Secure Connection (SSL — only check for port 465)
                            </label>

                            {mode === 'email' && (
                                <div className="help-box">
                                    <p className="help-title">iCloud Mail Quick Setup</p>
                                    <ul className="help-list">
                                        <li><strong>SMTP Username:</strong> Your <code>@icloud.com</code> address (e.g., <code>mohamed.arabi16@icloud.com</code>)</li>
                                        <li><strong>Sender Email:</strong> Your custom domain (e.g., <code>studybuddy@qobouli.com</code>)</li>
                                        <li><strong>Port 587</strong> with Secure <strong>unchecked</strong> (uses STARTTLS)</li>
                                        <li><strong>Password:</strong> App-Specific Password from <a href="https://appleid.apple.com/account/manage" target="_blank" rel="noopener noreferrer" className="help-link">Apple ID settings</a></li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Email Content */}
                    <div className="card">
                        <h3 className="card-title">
                            {mode === 'email' ? <Mail className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                            {mode === 'email' ? ' Email Content' : ' Message Content'}
                        </h3>

                        <div className="smtp-grid">
                            {mode === 'email' && (
                                <div className="field-group">
                                    <label className="field-label">From Name</label>
                                    <input
                                        type="text"
                                        placeholder="StudyBuddy"
                                        value={smtpConfig.fromName}
                                        onChange={e => setSmtpConfig({ ...smtpConfig, fromName: e.target.value })}
                                        className="field-input"
                                    />
                                </div>
                            )}
                            {mode === 'email' && (
                                <div className="field-group">
                                    <label className="field-label">
                                        Delay Between Emails
                                    </label>
                                    <div className="delay-input-wrapper">
                                        <Clock className="w-4 h-4 delay-icon" />
                                        <input
                                            type="number"
                                            min={0}
                                            max={30}
                                            value={sendDelay}
                                            onChange={e => setSendDelay(Number(e.target.value))}
                                            className="field-input delay-input"
                                        />
                                        <span className="delay-suffix">seconds</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {mode === 'email' && (
                            <div className="field-group">
                                <label className="field-label">Subject</label>
                                <input
                                    type="text"
                                    placeholder="Hello {{الاسم الكامل}}, welcome!"
                                    value={emailContent.subject}
                                    onChange={e => setEmailContent({ ...emailContent, subject: e.target.value })}
                                    className="field-input"
                                />
                            </div>
                        )}

                        <div className="field-group">
                            <div className="flex justify-between items-center mb-2">
                                <label className="field-label mb-0">Message Body</label>
                                <button
                                    onClick={() => setIsRTL(!isRTL)}
                                    className={`text-xs px-2 py-1 rounded border ${isRTL ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}
                                >
                                    {isRTL ? 'Direction: Right-to-Left (Arabic)' : 'Direction: Left-to-Right (English)'}
                                </button>
                            </div>
                            <textarea
                                rows={8}
                                dir={isRTL ? 'rtl' : 'ltr'}
                                placeholder={`Use {{Column_Name}} to insert CSV values.\n\nExample:\n<h2>مرحباً {{الاسم الكامل}}</h2>\n<p>Thank you for signing up, {{الاسم الكامل}}!</p>\n<p>We'll reach you at {{البريد الإلكتروني}}</p>`}
                                value={emailContent.body}
                                onChange={e => setEmailContent({ ...emailContent, body: e.target.value })}
                                className="field-textarea"
                            />
                        </div>

                        {/* Variable Tags */}
                        {headers.length > 0 && (
                            <div className="var-section">
                                <p className="var-label">Available variables — click to insert:</p>
                                <div className="var-tags">
                                    {headers.map(h => (
                                        <button
                                            key={h}
                                            onClick={() => setEmailContent({ ...emailContent, body: emailContent.body + `{{${h}}}` })}
                                            className={`var-tag ${detectedVars.includes(h) ? 'used' : ''}`}
                                        >
                                            {`{{${h}}}`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Preview Toggle */}
                        <button
                            onClick={() => setShowPreview(!showPreview)}
                            className="btn-secondary"
                        >
                            <Eye className="w-4 h-4" />
                            {showPreview ? 'Hide Preview' : 'Preview Email'}
                        </button>

                        {showPreview && data.length > 0 && (
                            <div className="preview-card">
                                <div className="preview-header">
                                    <span className="preview-label">Preview for row {previewRow + 1} of {data.length}</span>
                                    <div className="preview-nav">
                                        <button
                                            onClick={() => setPreviewRow(Math.max(0, previewRow - 1))}
                                            disabled={previewRow === 0}
                                            className="preview-nav-btn"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setPreviewRow(Math.min(data.length - 1, previewRow + 1))}
                                            disabled={previewRow >= data.length - 1}
                                            className="preview-nav-btn"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div className="preview-meta">
                                    <p><strong>To:</strong> {mode === 'email' ? previewData.recipientEmail : (mapping.phone ? (data[previewRow]?.[mapping.phone] || '') : '')}</p>
                                    {mode === 'email' && (
                                        <>
                                            <p><strong>From:</strong> &quot;{smtpConfig.fromName}&quot; &lt;{smtpConfig.fromEmail || smtpConfig.user}&gt;</p>
                                            <p><strong>Subject:</strong> {previewData.subject}</p>
                                        </>
                                    )}
                                </div>
                                <div className="preview-divider" />
                                {mode === 'email' ? (
                                    <div
                                        className="preview-body"
                                        dir={isRTL ? 'rtl' : 'ltr'}
                                        dangerouslySetInnerHTML={{ __html: previewData.body }}
                                    />
                                ) : (
                                    <div
                                        className="preview-body whitespace-pre-wrap"
                                        dir={isRTL ? 'rtl' : 'ltr'}
                                        style={{ fontFamily: 'sans-serif' }}
                                    >
                                        {previewData.body}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* WhatsApp Anti-Ban Settings Panel (Phase 2, Tasks 8–12) */}
                    {mode === 'whatsapp' && (
                        <div className="card">
                            <h3 className="card-title">
                                <Zap className="w-4 h-4" /> WhatsApp Anti-Ban Settings
                            </h3>

                            {/* Delay preset (Task 8) */}
                            <div className="field-group">
                                <label className="field-label">Delay Between Messages</label>
                                <div className="flex gap-2 flex-wrap">
                                    {(['fast', 'normal', 'safe', 'custom'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setWaDelayPreset(p)}
                                            className={`px-3 py-1 text-sm rounded-md border transition-all ${waDelayPreset === p ? 'bg-green-50 border-green-400 text-green-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                                        >
                                            {p === 'fast' ? 'Fast (5s)' : p === 'normal' ? 'Normal (10s)' : p === 'safe' ? 'Safe (15s)' : 'Custom'}
                                        </button>
                                    ))}
                                </div>
                                {waDelayPreset === 'custom' && (
                                    <div className="delay-input-wrapper mt-2">
                                        <Clock className="w-4 h-4 delay-icon" />
                                        <input
                                            type="number"
                                            min={3}
                                            max={60}
                                            value={waCustomDelay}
                                            onChange={e => setWaCustomDelay(Math.min(60, Math.max(3, Number(e.target.value))))}
                                            className="field-input delay-input"
                                        />
                                        <span className="delay-suffix">seconds (3–60)</span>
                                    </div>
                                )}
                            </div>

                            <div className="smtp-grid">
                                {/* Batch size (Task 11) */}
                                <div className="field-group">
                                    <label className="field-label">Batch Size (messages before pause)</label>
                                    <input
                                        type="number"
                                        min={5}
                                        max={50}
                                        value={waBatchSize}
                                        onChange={e => setWaBatchSize(Math.min(50, Math.max(5, Number(e.target.value))))}
                                        className="field-input"
                                    />
                                    <p className="field-hint">Range 5–50. Default: 10.</p>
                                </div>
                                {/* Cool-down (Task 11) */}
                                <div className="field-group">
                                    <label className="field-label">Cool-Down Duration (seconds)</label>
                                    <input
                                        type="number"
                                        min={30}
                                        max={300}
                                        value={waCoolDown}
                                        onChange={e => setWaCoolDown(Math.min(300, Math.max(30, Number(e.target.value))))}
                                        className="field-input"
                                    />
                                    <p className="field-hint">Range 30–300. Default: 60.</p>
                                </div>
                            </div>

                            {/* Daily limit (Task 12) */}
                            <div className="field-group">
                                <label className="field-label">Daily Send Limit</label>
                                <div className="delay-input-wrapper">
                                    <input
                                        type="number"
                                        min={1}
                                        value={waDailyLimit}
                                        onChange={e => setWaDailyLimit(Math.max(1, Number(e.target.value)))}
                                        className="field-input delay-input"
                                    />
                                    <span className="delay-suffix">messages · {waDailyCount} sent today</span>
                                </div>
                                {waDailyCount >= waDailyWarningThreshold && waDailyCount < waDailyLimit && (
                                    <p className="field-warning">⚠️ Approaching daily limit ({waDailyCount}/{waDailyLimit})</p>
                                )}
                            </div>

                            {/* Toggles (Tasks 9 & 10) */}
                            <div className="flex gap-6 flex-wrap">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={waJitter}
                                        onChange={e => setWaJitter(e.target.checked)}
                                        className="checkbox-input"
                                    />
                                    Random delay jitter (±30–50%)
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={waSpinEnabled}
                                        onChange={e => setWaSpinEnabled(e.target.checked)}
                                        className="checkbox-input"
                                    />
                                    Message spin syntax <code>{'{Hi|Hello|Hey}'}</code>
                                </label>
                            </div>

                            {/* Task 19 — Media attachment */}
                            <div className="field-group" style={{ marginTop: 8 }}>
                                <label className="field-label">
                                    <Paperclip className="w-4 h-4" style={{ display: 'inline', marginRight: 4 }} />
                                    Attach Media (optional — sent with every message)
                                </label>
                                {waMediaFile ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '6px 12px' }}>
                                        <Paperclip className="w-4 h-4" style={{ color: 'var(--green)' }} />
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{waMediaFile.name} ({(waMediaFile.size / 1024).toFixed(0)} KB)</span>
                                        <button onClick={handleClearMedia} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                                            <X className="w-4 h-4" style={{ color: 'var(--red)' }} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => waMediaInputRef.current?.click()}
                                        className="btn-secondary"
                                        style={{ width: '100%' }}
                                    >
                                        <Paperclip className="w-4 h-4" /> Attach Image or Document
                                    </button>
                                )}
                                <input
                                    ref={waMediaInputRef}
                                    type="file"
                                    accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                                    onChange={handleMediaFileChange}
                                    className="hidden"
                                />
                                <p className="field-hint">PNG, JPG, GIF, WebP, PDF, DOCX, XLSX · Max 16 MB</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => setStep(4)}
                        disabled={
                            mode === 'email'
                                ? !emailContent.subject || !emailContent.body || !smtpConfig.user || !smtpConfig.pass
                                : !emailContent.body
                        }
                        className="btn-primary"
                    >
                        Ready to Send <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Step 4: Sending */}
            {step === 4 && (
                <div className="step-content">
                    {sendingStatus === 'idle' && (
                        <div className="launch-card">
                            <div className="launch-icon">
                                {mode === 'email' ? <Send className="w-12 h-12" /> : <MessageCircle className="w-12 h-12" />}
                            </div>
                            <h2 className="launch-title">Ready to Launch</h2>
                            <p className="launch-subtitle">
                                {mode === 'email'
                                    ? <>Sending <strong>{data.length}</strong> emails from <strong>{smtpConfig.fromEmail || smtpConfig.user}</strong></>
                                    : <>Sending <strong>{data.length}</strong> WhatsApp messages</>
                                }
                            </p>

                            {/* WhatsApp connection status warning (Phase 3, Task 14) */}
                            {mode === 'whatsapp' && waStatus !== 'ready' && (
                                <div className="help-box" style={{ textAlign: 'left', marginBottom: 12 }}>
                                    <p className="help-title">
                                        {waStatus === 'reconnecting' ? '🔄 Reconnecting to WhatsApp…' : '⚠️ WhatsApp Not Connected'}
                                    </p>
                                    <p style={{ fontSize: 13, marginTop: 4 }}>
                                        {waStatus === 'reconnecting'
                                            ? 'A saved session was found and is being restored. Please wait a moment before sending.'
                                            : <>Status: <strong>{waStatus}</strong>. Use the <strong>WhatsApp Connection</strong> panel above to scan a QR code and authenticate before sending.</>
                                        }
                                    </p>
                                </div>
                            )}

                            {/* Daily limit warning / block (Task 12) */}
                            {mode === 'whatsapp' && (
                                <>
                                    {waDailyCount >= waDailyLimit && !waLimitOverridden ? (
                                        <div className="help-box" style={{ textAlign: 'left', marginBottom: 12 }}>
                                            <p className="help-title">🚫 Daily Limit Reached ({waDailyCount}/{waDailyLimit})</p>
                                            <p style={{ fontSize: 13, marginTop: 4 }}>Sending is blocked. Override below to continue (ban risk!).</p>
                                            <button
                                                className="btn-secondary"
                                                style={{ marginTop: 8 }}
                                                onClick={() => {
                                                    if (window.confirm('⚠️ You have reached the daily limit. Sending more messages increases your ban risk. Are you sure you want to continue?')) {
                                                        setWaLimitOverridden(true);
                                                    }
                                                }}
                                            >
                                                Override Daily Limit
                                            </button>
                                        </div>
                                    ) : waDailyCount >= waDailyWarningThreshold ? (
                                        <div style={{ background: 'var(--amber-bg)', border: '1px solid var(--amber)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--amber)' }}>
                                            ⚠️ Approaching daily limit: {waDailyCount}/{waDailyLimit} messages sent today.
                                        </div>
                                    ) : null}
                                </>
                            )}

                            {/* Number Validation (Task 13) */}
                            {mode === 'whatsapp' && (
                                <div style={{ marginBottom: 12, width: '100%' }}>
                                    {waValidationResults.length === 0 ? (
                                        <button
                                            onClick={handleValidateNumbers}
                                            disabled={waValidating || waStatus !== 'ready'}
                                            className="btn-secondary"
                                            style={{ width: '100%' }}
                                        >
                                            <Phone className="w-4 h-4" />
                                            {waValidating ? 'Validating numbers…' : 'Validate Numbers (optional)'}
                                        </button>
                                    ) : (
                                        <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13 }}>
                                            <strong style={{ color: 'var(--green)' }}>
                                                ✅ {waValidationResults.filter(r => r.valid).length} valid
                                            </strong>
                                            {' · '}
                                            <strong style={{ color: 'var(--red)' }}>
                                                {waValidationResults.filter(r => !r.valid).length} not on WhatsApp
                                            </strong>
                                            {' '}(will be skipped)
                                            <button
                                                onClick={() => setWaValidationResults([])}
                                                style={{ marginLeft: 12, fontSize: 12, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="launch-summary">
                                {mode === 'email' && (
                                    <div className="summary-item">
                                        <Zap className="w-4 h-4" />
                                        <span>{sendDelay}s delay between emails</span>
                                    </div>
                                )}
                                {mode === 'whatsapp' && (
                                    <div className="summary-item">
                                        <Clock className="w-4 h-4" />
                                        <span>
                                            {waDelayPreset === 'custom' ? `${waCustomDelay}s` : `${WA_DELAY_PRESETS[waDelayPreset] / 1000}s`} delay
                                            {waJitter ? ' + jitter' : ''}
                                            {' · '}pause every {waBatchSize} msgs for {waCoolDown}s
                                        </span>
                                    </div>
                                )}
                                <div className="summary-item">
                                    <Clock className="w-4 h-4" />
                                    <span>~{Math.ceil(data.length * (mode === 'email' ? sendDelay : getWABaseDelay() / 1000) / 60)} min total</span>
                                </div>
                            </div>

                            <button
                                onClick={mode === 'email' ? handleSendEmails : handleSendWhatsApp}
                                disabled={mode === 'whatsapp' && !waLimitOverridden && waDailyCount >= waDailyLimit}
                                className="btn-send"
                            >
                                {mode === 'email' ? <Send className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
                                {mode === 'email' ? 'Start Sending' : (waScheduleEnabled && waScheduledTime ? `Send at Scheduled Time` : 'Start Messaging')}
                            </button>

                            {/* Task 21 — Schedule UI */}
                            {mode === 'whatsapp' && (
                                <div style={{ width: '100%', marginTop: 8 }}>
                                    <label className="checkbox-label">
                                        <input
                                            type="checkbox"
                                            checked={waScheduleEnabled}
                                            onChange={e => setWaScheduleEnabled(e.target.checked)}
                                            className="checkbox-input"
                                        />
                                        <Calendar className="w-4 h-4" style={{ marginLeft: 4, marginRight: 2 }} />
                                        Schedule for later
                                    </label>
                                    {waScheduleEnabled && (
                                        <div style={{ marginTop: 8 }}>
                                            <input
                                                type="datetime-local"
                                                min={scheduleMinTime}
                                                value={waScheduledTime}
                                                onChange={e => setWaScheduledTime(e.target.value)}
                                                className="field-input"
                                                style={{ fontSize: 13 }}
                                            />
                                            {waScheduledTime && (
                                                <div style={{ marginTop: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                    <Clock className="w-4 h-4" />
                                                    {waScheduleCountdown === 'Now'
                                                        ? <span style={{ color: 'var(--green)' }}>Sending now…</span>
                                                        : <span>Sends in <strong>{waScheduleCountdown}</strong></span>
                                                    }
                                                    <button
                                                        onClick={() => { setWaScheduleEnabled(false); setWaScheduledTime(''); }}
                                                        style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', color: 'var(--red)' }}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <button onClick={() => setStep(3)} className="btn-back">
                                ← Go back and edit
                            </button>
                        </div>
                    )}

                    {(sendingStatus === 'sending' || sendingStatus === 'completed') && (
                        <div className="results-section">
                            <h3 className="results-title">
                                {sendingStatus === 'sending'
                                    ? (waReconnectPrompt
                                        ? '⚠️ Reconnecting — waiting for WhatsApp…'
                                        : waCoolDownActive
                                        ? `⏸ Cool-Down — resuming in ${waCoolDownRemaining}s…`
                                        : 'Sending in progress…')
                                    : 'Sending Complete'}
                            </h3>

                            {/* Progress Bar */}
                            <div className="progress-bar-bg">
                                <div
                                    className="progress-bar-fill"
                                    style={{ width: `${currentProgress}%` }}
                                />
                            </div>
                            <p className="progress-text">{Math.round(currentProgress)}% — {logs.filter(l => l.status !== 'info').length} of {data.length} processed</p>

                            {/* Stats */}
                            {logs.length > 0 && (
                                <div className="stats-grid">
                                    <div className="stat-card success">
                                        <CheckCircle className="w-5 h-5" />
                                        <div>
                                            <p className="stat-number">{successCount}</p>
                                            <p className="stat-label">Delivered</p>
                                        </div>
                                    </div>
                                    <div className="stat-card error">
                                        <AlertCircle className="w-5 h-5" />
                                        <div>
                                            <p className="stat-number">{errorCount}</p>
                                            <p className="stat-label">Failed</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Logs */}
                            <div className="logs-container">
                                {logs.map((log, i) => {
                                    // Task 20 — Show ACK status for WhatsApp messages
                                    const ack = log.messageId ? waAckMap[log.messageId] : undefined;
                                    const ackDisplay = ack !== undefined ? ACK_DISPLAY[ack] : null;
                                    return (
                                        <div key={i} className={`log-entry ${log.status}`}>
                                            {log.status === 'success'
                                                ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                                                : log.status === 'info'
                                                ? <Clock className="w-4 h-4 flex-shrink-0" />
                                                : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                                            <span className="log-email">{log.email}</span>
                                            {log.message && <span className="log-message">— {log.message}</span>}
                                            {ackDisplay && (
                                                <span style={{ marginLeft: 'auto', fontSize: 12, color: ackDisplay.color, flexShrink: 0, fontWeight: 500 }} title={ackDisplay.label}>
                                                    {ackDisplay.icon}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                                {sendingStatus === 'sending' && !waCoolDownActive && !waReconnectPrompt && (
                                    <div className="log-entry sending">
                                        <RefreshCw className="w-4 h-4 animate-spin flex-shrink-0" />
                                        <span>{mode === 'email' ? 'Sending next email…' : 'Preparing next message…'}</span>
                                    </div>
                                )}
                            </div>

                            {sendingStatus === 'completed' && (
                                <>
                                    {/* Task 20 — ACK summary */}
                                    {mode === 'whatsapp' && Object.keys(waAckMap).length > 0 && (
                                        <div style={{ fontSize: 13, marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                                            {([0, 1, 2, 3] as AckLevel[]).map(level => {
                                                const count = Object.values(waAckMap).filter(a => a === level).length;
                                                if (count === 0) return null;
                                                const d = ACK_DISPLAY[level];
                                                return (
                                                    <span key={level} style={{ color: d.color, fontWeight: 500 }}>
                                                        {d.icon} {d.label}: {count}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                    <button
                                        onClick={() => {
                                            setSendingStatus('idle');
                                            setLogs([]);
                                            setCurrentProgress(0);
                                            setStep(1);
                                            setFile(null);
                                            setData([]);
                                            setHeaders([]);
                                        }}
                                        className="btn-secondary start-over"
                                    >
                                        <RefreshCw className="w-4 h-4" /> Start New Campaign
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
