import React, { useState, useRef, useCallback, useEffect } from 'react';
import { parseCSV, loadContactsFromStorage, saveContactsToStorage, resolveTemplate, resolveSpin } from '../lib/csv-parser';
import { sendToBackground } from '../lib/messaging';
import type { ExtensionSettings } from '../lib/storage';
import type { Contact } from '../lib/csv-parser';
import DOMPurify from 'dompurify';

type LogEntry = { recipient: string; status: 'success' | 'error' | 'skipped'; message?: string };
type SendingStatus = 'idle' | 'sending' | 'cooldown' | 'completed';

const DEFAULT_SETTINGS: ExtensionSettings = {
  defaultMode: 'email',
  delayPreset: 'normal',
  customDelaySeconds: 10,
  jitterEnabled: true,
  batchSize: 10,
  cooldownSeconds: 60,
  dailyLimit: 200,
  spinSyntaxEnabled: true,
  sidebarPosition: 'right',
};

export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialMode = (urlParams.get('mode') === 'whatsapp' ? 'whatsapp' : 'email') as 'email' | 'whatsapp';

  const [mode, setMode] = useState<'email' | 'whatsapp'>(initialMode);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneColumn, setPhoneColumn] = useState('');
  const [emailColumn, setEmailColumn] = useState('');
  const [template, setTemplate] = useState('Hello {{Name}},\n\nYour message here.');
  const [subject, setSubject] = useState('');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SendingStatus>('idle');
  const [progress, setProgress] = useState({ current: 0, total: 0, sent: 0, failed: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [summary, setSummary] = useState<{ sent: number; failed: number; skipped: number } | null>(null);
  const [dailyCount, setDailyCount] = useState({ sent: 0, limit: 200 });
  const [csvWarning, setCsvWarning] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [preflight, setPreflight] = useState<{ ready: boolean; failures: string[] } | null>(null);
  const [haltedJob, setHaltedJob] = useState<{ sent: number; total: number; error: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load settings and daily count on mount
  useEffect(() => {
    sendToBackground<ExtensionSettings>('GET_SETTINGS')
      .then(setSettings)
      .catch(() => setErrorBanner('Failed to load settings — using defaults'));

    sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT')
      .then(setDailyCount)
      .catch(() => setErrorBanner('Failed to load daily count'));

    loadContactsFromStorage().then((saved) => {
      if (saved && saved.length > 0) {
        setContacts(saved);
        setHeaders(Object.keys(saved[0]));
      }
    }).catch(() => setErrorBanner('Failed to load saved contacts'));

    if (initialMode === 'whatsapp') {
      sendToBackground<{ status?: string; sent?: number; failed?: number; lastError?: string; contacts?: unknown[] } | null>('GET_ACTIVE_WA_JOB')
        .then((job) => {
          if (job && job.status === 'halted') {
            setHaltedJob({
              sent: job.sent ?? 0,
              total: (job.contacts as unknown[])?.length ?? 0,
              error: job.lastError ?? 'Unknown error',
            });
          }
        })
        .catch(() => {});
    }

    window.parent.postMessage({ type: 'PREFLIGHT_CHECK' }, '*');
  }, []);

  // Listen for progress events from content script
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as { type: string; [key: string]: unknown };
      if (!data?.type) return;

      if (data.type === 'PREFLIGHT_RESULT') {
        const { ready, failures } = data as unknown as { ready: boolean; failures: string[] };
        setPreflight({ ready, failures });
      } else if (data.type === 'JOB_START_ERROR') {
        setErrorBanner(`Failed to start job: ${data.error}`);
        setStatus('idle');
      } else if (data.type === 'BULK_SENDER_PROGRESS') {
        const { current, total, sent, failed, status: st, recipient, error } = data as unknown as {
          current: number; total: number; sent: number; failed: number;
          status: string; recipient: string; error?: string;
        };
        setProgress({ current, total, sent, failed });
        setStatus('sending');
        setLogs((prev) => [...prev, {
          recipient,
          status: st as 'success' | 'error' | 'skipped',
          message: error,
        }]);
      } else if (data.type === 'BULK_SENDER_COOLDOWN') {
        const seconds = data.seconds as number;
        setStatus('cooldown');
        setCooldownRemaining(seconds);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
          setCooldownRemaining((prev) => {
            if (prev <= 1) {
              if (cooldownRef.current) clearInterval(cooldownRef.current);
              setStatus('sending');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else if (data.type === 'BULK_SENDER_COMPLETE') {
        const { sent, failed, skipped, halted, error } = data as unknown as {
          sent: number; failed: number; skipped: number; halted?: boolean; error?: string;
        };
        setSummary({ sent, failed, skipped });
        setStatus('completed');
        if (halted && error) {
          setErrorBanner(error);
        }
        sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT')
          .then(setDailyCount)
          .catch(() => {});
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  function detectColumn(hdrs: string[], patterns: RegExp[]): string {
    for (const h of hdrs) {
      const lower = h.toLowerCase();
      for (const p of patterns) {
        if (p.test(lower) || p.test(h)) return h;
      }
    }
    return '';
  }

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const { headers: h, contacts: c } = await parseCSV(file);
      setHeaders(h);
      setContacts(c);
      setCsvWarning(c.length > 5000 ? `⚠️ ${c.length} contacts — approaching storage limit. Consider splitting the CSV.` : '');
      // Auto-detect phone and email columns
      const phonePat = [/phone/i, /واتساب/, /whatsapp/i, /mobile/i, /tel/i, /رقم/];
      const emailPat = [/email/i, /بريد/, /mail/i];
      setPhoneColumn(detectColumn(h, phonePat));
      setEmailColumn(detectColumn(h, emailPat));
      await saveContactsToStorage(c);
    } catch (err) {
      setErrorBanner('Failed to parse CSV: ' + String(err));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  function mapContacts(raw: Contact[]): Contact[] {
    return raw.map(c => {
      const mapped = { ...c };
      if (phoneColumn && phoneColumn !== 'phone') mapped.phone = c[phoneColumn] ?? '';
      if (emailColumn && emailColumn !== 'email') mapped.email = c[emailColumn] ?? '';
      return mapped;
    });
  }

  const resolvedPreview = contacts.length > 0
    ? resolveSpin(resolveTemplate(template, contacts[previewIdx] ?? {}))
    : template;

  // Sanitize preview for display
  const safePreview = DOMPurify.sanitize(resolvedPreview);

  function startJob() {
    if (contacts.length === 0) { setErrorBanner('Please upload a CSV first.'); return; }
    if (mode === 'email' && !subject) { setErrorBanner('Please enter a subject line.'); return; }
    if (mode === 'email' && !emailColumn) { setErrorBanner('Please select which column contains email addresses.'); return; }
    if (mode === 'whatsapp' && !phoneColumn) { setErrorBanner('Please select which column contains phone numbers.'); return; }
    setErrorBanner('');
    setStatus('sending');
    setLogs([]);
    setSummary(null);
    setProgress({ current: 0, total: contacts.length, sent: 0, failed: 0 });

    const mapped = mapContacts(contacts);
    if (mode === 'email') {
      window.parent.postMessage({ type: 'START_EMAIL_JOB', contacts: mapped, template, subject, settings }, '*');
    } else {
      window.parent.postMessage({ type: 'START_WA_JOB', contacts: mapped, template, settings }, '*');
    }
  }

  function cancelJob() {
    window.parent.postMessage({ type: 'CANCEL_JOB' }, '*');
    setStatus('idle');
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif', fontSize: '13px', height: '100vh', overflowY: 'auto', background: '#0a0a0a', color: '#fafafa' }}>
      {/* Header */}
      <div style={{ background: '#171717', color: '#fafafa', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #262626' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 72 72" fill="none">
            <path d="M36 12L60 24L36 36L12 24L36 12Z" fill="#10b981" opacity="0.9"/>
            <path d="M60 32L36 44L12 32" stroke="#34d399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M60 42L36 54L12 42" stroke="#6ee7b7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '15px' }}>Send<span style={{ color: '#34d399' }}>Stack</span></span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setMode('email')} style={{ background: mode === 'email' ? '#10b981' : 'transparent', color: mode === 'email' ? '#fff' : '#a1a1aa', border: '1px solid #262626', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' }}>Email</button>
          <button onClick={() => setMode('whatsapp')} style={{ background: mode === 'whatsapp' ? '#10b981' : 'transparent', color: mode === 'whatsapp' ? '#fff' : '#a1a1aa', border: '1px solid #262626', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' }}>WhatsApp</button>
        </div>
      </div>

      {/* Daily count */}
      <div style={{ background: '#171717', padding: '6px 16px', fontSize: '12px', borderBottom: '1px solid #262626', color: '#71717a' }}>
        Today: <b style={{ color: '#a1a1aa' }}>{dailyCount.sent}</b> / {dailyCount.limit} messages sent
      </div>

      {/* Error banner */}
      {errorBanner && (
        <div style={{ background: 'rgba(255, 59, 48, 0.15)', color: '#ff3b30', padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff3b30', fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Pre-flight status */}
      {preflight && !preflight.ready && (
        <div style={{ background: '#fce8e6', color: '#c5221f', padding: '8px 16px', fontSize: '12px', borderBottom: '1px solid #e0e0e0' }}>
          <b>Blocked:</b> Cannot find: {preflight.failures.join(', ')}. The site UI may have changed — extension may need an update.
        </div>
      )}
      {preflight && preflight.ready && status === 'idle' && (
        <div style={{ background: '#e6f4ea', color: '#137333', padding: '6px 16px', fontSize: '12px', borderBottom: '1px solid #a8d5b5' }}>
          Ready to send
        </div>
      )}

      {/* Halted job recovery */}
      {haltedJob && (
        <div style={{ background: '#fef7e0', color: '#8a6d3b', padding: '10px 16px', fontSize: '12px', borderBottom: '1px solid #f0d58c' }}>
          <div style={{ marginBottom: '6px' }}>
            <b>Previous job halted</b> after sending {haltedJob.sent}/{haltedJob.total} messages.
          </div>
          <div style={{ marginBottom: '8px', fontSize: '11px' }}>Error: {haltedJob.error}</div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => {
                sendToBackground('STORE_WA_JOB', { status: 'running', consecutiveFailures: 0, lastError: '' } as unknown as Record<string, unknown>)
                  .then(() => sendToBackground<{ contacts: { phone?: string }[]; currentIndex: number } | null>('GET_ACTIVE_WA_JOB'))
                  .then((job) => {
                    if (job) {
                      const next = job.contacts[job.currentIndex];
                      const phone = next?.phone?.replace(/[\s\-+]/g, '') ?? '';
                      if (phone) window.parent.location.href = `https://web.whatsapp.com/send?phone=${phone}`;
                    }
                    setHaltedJob(null);
                  })
                  .catch(() => setErrorBanner('Failed to resume job'));
              }}
              style={{ padding: '4px 12px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
            >
              Resume
            </button>
            <button
              onClick={() => {
                sendToBackground('CANCEL_WA_JOB', {}).catch(() => {});
                setHaltedJob(null);
              }}
              style={{ padding: '4px 12px', background: '#d93025', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* CSV Upload */}
        <section>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: '#a1a1aa' }}>Contacts CSV</div>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: '2px dashed #262626', borderRadius: '8px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#171717' }}
          >
            {contacts.length > 0
              ? <span style={{ color: '#34d399' }}>{contacts.length} contacts loaded ({headers.join(', ')})</span>
              : <span style={{ color: '#71717a' }}>Drop CSV here or click to browse</span>}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
          {csvWarning && <div style={{ color: '#ff9f0a', fontSize: '12px', marginTop: '4px' }}>{csvWarning}</div>}
          {/* Column mapping */}
          {headers.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
              {(mode === 'whatsapp' || mode === 'email') && (
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', color: '#71717a', display: 'block', marginBottom: '2px' }}>
                    {mode === 'whatsapp' ? 'Phone column' : 'Email column'}
                  </label>
                  <select
                    value={mode === 'whatsapp' ? phoneColumn : emailColumn}
                    onChange={(e) => mode === 'whatsapp' ? setPhoneColumn(e.target.value) : setEmailColumn(e.target.value)}
                    style={{ width: '100%', padding: '4px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '4px', fontSize: '12px' }}
                  >
                    <option value="">— Select —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Template Editor */}
        <section>
          <div style={{ fontWeight: 600, marginBottom: '6px', color: '#a1a1aa' }}>Message Template</div>
          {mode === 'email' && (
            <input
              placeholder="Subject (supports {{Variable}})"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #262626', borderRadius: '6px', marginBottom: '6px', boxSizing: 'border-box', background: '#171717', color: '#fafafa' }}
            />
          )}
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={5}
            placeholder={'Hello {{Name}},\nYour message here.\n\nUse {Hi|Hello|Hey} for spin syntax.'}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #262626', borderRadius: '6px', resize: 'vertical', fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: '12px', boxSizing: 'border-box', background: '#171717', color: '#fafafa' }}
          />
          {contacts.length > 0 && (
            <details style={{ marginTop: '6px' }}>
              <summary style={{ cursor: 'pointer', color: '#71717a', fontSize: '12px' }}>Preview (contact {previewIdx + 1} of {contacts.length})</summary>
              <div style={{ display: 'flex', gap: '6px', margin: '4px 0' }}>
                <button onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))} disabled={previewIdx === 0} style={{ padding: '2px 8px', cursor: 'pointer', background: '#171717', color: '#a1a1aa', border: '1px solid #262626', borderRadius: '4px' }}>‹</button>
                <button onClick={() => setPreviewIdx(Math.min(contacts.length - 1, previewIdx + 1))} disabled={previewIdx === contacts.length - 1} style={{ padding: '2px 8px', cursor: 'pointer', background: '#171717', color: '#a1a1aa', border: '1px solid #262626', borderRadius: '4px' }}>›</button>
              </div>
              <pre
                style={{ background: '#171717', padding: '8px', borderRadius: '6px', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#a1a1aa', border: '1px solid #262626' }}
                dangerouslySetInnerHTML={{ __html: safePreview }}
              />
            </details>
          )}
        </section>

        {/* Settings */}
        <section>
          <details>
            <summary style={{ fontWeight: 600, cursor: 'pointer', color: '#a1a1aa' }}>Settings</summary>
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#71717a' }}>Delay Preset</label>
                <select value={settings.delayPreset} onChange={(e) => setSettings({ ...settings, delayPreset: e.target.value as ExtensionSettings['delayPreset'] })} style={{ width: '100%', padding: '4px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '4px' }}>
                  <option value="fast">Fast (5s)</option>
                  <option value="normal">Normal (10s)</option>
                  <option value="safe">Safe (15s)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {settings.delayPreset === 'custom' && (
                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#71717a' }}>Custom Delay (seconds, 3–60)</label>
                  <input type="number" min={3} max={60} value={settings.customDelaySeconds} onChange={(e) => setSettings({ ...settings, customDelaySeconds: Math.max(3, Math.min(60, Number(e.target.value))) })} style={{ width: '100%', padding: '4px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '4px' }} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="jitter" checked={settings.jitterEnabled} onChange={(e) => setSettings({ ...settings, jitterEnabled: e.target.checked })} />
                <label htmlFor="jitter" style={{ fontSize: '12px', color: '#a1a1aa' }}>Enable random jitter (±30–50%)</label>
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#71717a' }}>Batch Size (min 5)</label>
                <input type="number" min={5} max={100} value={settings.batchSize} onChange={(e) => setSettings({ ...settings, batchSize: Math.max(5, Number(e.target.value)) })} style={{ width: '100%', padding: '4px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#71717a' }}>Batch Cool-down (seconds)</label>
                <input type="number" min={10} max={600} value={settings.cooldownSeconds} onChange={(e) => setSettings({ ...settings, cooldownSeconds: Math.max(10, Number(e.target.value)) })} style={{ width: '100%', padding: '4px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px', color: '#71717a' }}>Daily Limit</label>
                <input type="number" min={1} max={1000} value={settings.dailyLimit} onChange={(e) => setSettings({ ...settings, dailyLimit: Math.max(1, Number(e.target.value)) })} style={{ width: '100%', padding: '4px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="spin" checked={settings.spinSyntaxEnabled} onChange={(e) => setSettings({ ...settings, spinSyntaxEnabled: e.target.checked })} />
                <label htmlFor="spin" style={{ fontSize: '12px', color: '#a1a1aa' }}>Enable spin syntax {'{'+'A|B|C}'}</label>
              </div>
              <button
                onClick={() => sendToBackground('SAVE_SETTINGS', settings as unknown as Record<string, unknown>).catch(() => setErrorBanner('Failed to save settings'))}
                style={{ padding: '6px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Save Settings
              </button>
            </div>
          </details>
        </section>

        {/* Send Controls */}
        <section style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={startJob}
            disabled={status === 'sending' || status === 'cooldown' || (preflight !== null && !preflight.ready)}
            style={{ flex: 1, padding: '10px', background: status === 'sending' ? '#262626' : '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: status === 'sending' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            {status === 'sending' ? 'Sending...' : status === 'cooldown' ? `Cooldown ${cooldownRemaining}s` : 'Send Now'}
          </button>
          {(status === 'sending' || status === 'cooldown') && (
            <button onClick={cancelJob} style={{ padding: '10px 14px', background: '#ff3b30', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
          )}
        </section>

        {/* Progress */}
        {(status === 'sending' || status === 'cooldown' || status === 'completed') && (
          <section>
            <div style={{ fontWeight: 600, marginBottom: '6px', color: '#a1a1aa' }}>Progress</div>
            <div style={{ background: '#262626', borderRadius: '4px', overflow: 'hidden', height: '8px', marginBottom: '6px' }}>
              <div style={{ height: '100%', background: '#10b981', width: `${progressPct}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: '12px', color: '#71717a', marginBottom: '6px' }}>
              {progress.current} / {progress.total} &nbsp;|&nbsp; <span style={{ color: '#34c759' }}>{progress.sent} sent</span> &nbsp;|&nbsp; <span style={{ color: '#ff3b30' }}>{progress.failed} failed</span>
            </div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '11px', border: '1px solid #262626', borderRadius: '6px', padding: '6px', background: '#171717' }}>
              {logs.slice(-50).map((log, i) => (
                <div key={i} style={{ color: log.status === 'success' ? '#34d399' : log.status === 'error' ? '#ff3b30' : '#71717a', marginBottom: '2px' }}>
                  {log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '—'} {log.recipient}{log.message ? ` — ${log.message}` : ''}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Summary */}
        {summary && (
          <section style={{ background: 'rgba(52, 199, 89, 0.15)', border: '1px solid rgba(52, 199, 89, 0.3)', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: '#34c759' }}>Send Complete</div>
            <div style={{ color: '#a1a1aa' }}>Sent: <b style={{ color: '#34d399' }}>{summary.sent}</b> &nbsp; Failed: <b style={{ color: '#ff3b30' }}>{summary.failed}</b> &nbsp; Skipped: <b style={{ color: '#71717a' }}>{summary.skipped}</b></div>
          </section>
        )}
      </div>
    </div>
  );
}
