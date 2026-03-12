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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load settings and daily count on mount
  useEffect(() => {
    sendToBackground<ExtensionSettings>('GET_SETTINGS').then(setSettings).catch(console.error);
    sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT').then(setDailyCount).catch(console.error);
    loadContactsFromStorage().then((saved) => {
      if (saved && saved.length > 0) {
        setContacts(saved);
        setHeaders(Object.keys(saved[0]));
      }
    }).catch(console.error);
  }, []);

  // Listen for progress events from content script
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as { type: string; [key: string]: unknown };
      if (!data?.type) return;

      if (data.type === 'BULK_SENDER_PROGRESS') {
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
        const { sent, failed, skipped } = data as unknown as { sent: number; failed: number; skipped: number };
        setSummary({ sent, failed, skipped });
        setStatus('completed');
        sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT').then(setDailyCount).catch(console.error);
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const { headers: h, contacts: c } = await parseCSV(file);
      setHeaders(h);
      setContacts(c);
      setCsvWarning(c.length > 5000 ? `⚠️ ${c.length} contacts — approaching storage limit. Consider splitting the CSV.` : '');
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

  const resolvedPreview = contacts.length > 0
    ? resolveSpin(resolveTemplate(template, contacts[previewIdx] ?? {}))
    : template;

  // Sanitize preview for display
  const safePreview = DOMPurify.sanitize(resolvedPreview);

  function startJob() {
    if (contacts.length === 0) { setErrorBanner('Please upload a CSV first.'); return; }
    if (mode === 'email' && !subject) { setErrorBanner('Please enter a subject line.'); return; }
    setErrorBanner('');
    setStatus('sending');
    setLogs([]);
    setSummary(null);
    setProgress({ current: 0, total: contacts.length, sent: 0, failed: 0 });

    if (mode === 'email') {
      window.parent.postMessage({ type: 'START_EMAIL_JOB', contacts, template, subject, settings }, '*');
    } else {
      window.parent.postMessage({ type: 'START_WA_JOB', contacts, template, settings }, '*');
    }
  }

  function cancelJob() {
    window.parent.postMessage({ type: 'CANCEL_JOB' }, '*');
    setStatus('idle');
    if (cooldownRef.current) clearInterval(cooldownRef.current);
  }

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: '13px', height: '100vh', overflowY: 'auto', background: '#fff', color: '#111' }}>
      {/* Header */}
      <div style={{ background: mode === 'email' ? '#1a73e8' : '#25d366', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: '15px' }}>📨 Bulk Sender</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setMode('email')} style={{ background: mode === 'email' ? '#fff' : 'transparent', color: mode === 'email' ? '#1a73e8' : '#fff', border: '1px solid #fff', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' }}>✉ Email</button>
          <button onClick={() => setMode('whatsapp')} style={{ background: mode === 'whatsapp' ? '#fff' : 'transparent', color: mode === 'whatsapp' ? '#25d366' : '#fff', border: '1px solid #fff', borderRadius: '4px', padding: '3px 10px', cursor: 'pointer', fontSize: '12px' }}>💬 WhatsApp</button>
        </div>
      </div>

      {/* Daily count */}
      <div style={{ background: '#f8f9fa', padding: '6px 16px', fontSize: '12px', borderBottom: '1px solid #e0e0e0' }}>
        📊 Today: <b>{dailyCount.sent}</b> / {dailyCount.limit} messages sent
      </div>

      {/* Error banner */}
      {errorBanner && (
        <div style={{ background: '#fce8e6', color: '#c5221f', padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>⚠️ {errorBanner}</span>
          <button onClick={() => setErrorBanner('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c5221f', fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* CSV Upload */}
        <section>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>📁 Contacts CSV</div>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            style={{ border: '2px dashed #ccc', borderRadius: '6px', padding: '16px', textAlign: 'center', cursor: 'pointer', background: '#fafafa' }}
          >
            {contacts.length > 0
              ? <span>✅ {contacts.length} contacts loaded ({headers.join(', ')})</span>
              : <span>Drop CSV here or click to browse</span>}
          </div>
          <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }} />
          {csvWarning && <div style={{ color: '#e65c00', fontSize: '12px', marginTop: '4px' }}>{csvWarning}</div>}
        </section>

        {/* Template Editor */}
        <section>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>✏️ Message Template</div>
          {mode === 'email' && (
            <input
              placeholder="Subject (supports {{Variable}})"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '6px', boxSizing: 'border-box' }}
            />
          )}
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={5}
            placeholder={'Hello {{Name}},\nYour message here.\n\nUse {Hi|Hello|Hey} for spin syntax.'}
            style={{ width: '100%', padding: '6px 8px', border: '1px solid #ccc', borderRadius: '4px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', boxSizing: 'border-box' }}
          />
          {contacts.length > 0 && (
            <details style={{ marginTop: '6px' }}>
              <summary style={{ cursor: 'pointer', color: '#666', fontSize: '12px' }}>👁 Preview (contact {previewIdx + 1} of {contacts.length})</summary>
              <div style={{ display: 'flex', gap: '6px', margin: '4px 0' }}>
                <button onClick={() => setPreviewIdx(Math.max(0, previewIdx - 1))} disabled={previewIdx === 0} style={{ padding: '2px 8px', cursor: 'pointer' }}>‹</button>
                <button onClick={() => setPreviewIdx(Math.min(contacts.length - 1, previewIdx + 1))} disabled={previewIdx === contacts.length - 1} style={{ padding: '2px 8px', cursor: 'pointer' }}>›</button>
              </div>
              <pre
                style={{ background: '#f5f5f5', padding: '8px', borderRadius: '4px', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                dangerouslySetInnerHTML={{ __html: safePreview }}
              />
            </details>
          )}
        </section>

        {/* Settings */}
        <section>
          <details>
            <summary style={{ fontWeight: 600, cursor: 'pointer' }}>⚙️ Settings</summary>
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Delay Preset</label>
                <select value={settings.delayPreset} onChange={(e) => setSettings({ ...settings, delayPreset: e.target.value as ExtensionSettings['delayPreset'] })} style={{ width: '100%', padding: '4px' }}>
                  <option value="fast">Fast (5s)</option>
                  <option value="normal">Normal (10s)</option>
                  <option value="safe">Safe (15s)</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              {settings.delayPreset === 'custom' && (
                <div>
                  <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Custom Delay (seconds, 3–60)</label>
                  <input type="number" min={3} max={60} value={settings.customDelaySeconds} onChange={(e) => setSettings({ ...settings, customDelaySeconds: Math.max(3, Math.min(60, Number(e.target.value))) })} style={{ width: '100%', padding: '4px' }} />
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="jitter" checked={settings.jitterEnabled} onChange={(e) => setSettings({ ...settings, jitterEnabled: e.target.checked })} />
                <label htmlFor="jitter" style={{ fontSize: '12px' }}>Enable random jitter (±30–50%)</label>
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Batch Size (min 5)</label>
                <input type="number" min={5} max={100} value={settings.batchSize} onChange={(e) => setSettings({ ...settings, batchSize: Math.max(5, Number(e.target.value)) })} style={{ width: '100%', padding: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Batch Cool-down (seconds)</label>
                <input type="number" min={10} max={600} value={settings.cooldownSeconds} onChange={(e) => setSettings({ ...settings, cooldownSeconds: Math.max(10, Number(e.target.value)) })} style={{ width: '100%', padding: '4px' }} />
              </div>
              <div>
                <label style={{ fontSize: '12px', display: 'block', marginBottom: '2px' }}>Daily Limit</label>
                <input type="number" min={1} max={1000} value={settings.dailyLimit} onChange={(e) => setSettings({ ...settings, dailyLimit: Math.max(1, Number(e.target.value)) })} style={{ width: '100%', padding: '4px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="spin" checked={settings.spinSyntaxEnabled} onChange={(e) => setSettings({ ...settings, spinSyntaxEnabled: e.target.checked })} />
                <label htmlFor="spin" style={{ fontSize: '12px' }}>Enable spin syntax {'{'+'A|B|C}'}</label>
              </div>
              <button
                onClick={() => sendToBackground('SAVE_SETTINGS', settings as unknown as Record<string, unknown>).catch(console.error)}
                style={{ padding: '6px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                💾 Save Settings
              </button>
            </div>
          </details>
        </section>

        {/* Send Controls */}
        <section style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={startJob}
            disabled={status === 'sending' || status === 'cooldown'}
            style={{ flex: 1, padding: '10px', background: status === 'sending' ? '#aaa' : mode === 'email' ? '#1a73e8' : '#25d366', color: '#fff', border: 'none', borderRadius: '6px', cursor: status === 'sending' ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px' }}
          >
            {status === 'sending' ? '⏳ Sending...' : status === 'cooldown' ? `⏸ Cooldown ${cooldownRemaining}s` : '🚀 Send Now'}
          </button>
          {(status === 'sending' || status === 'cooldown') && (
            <button onClick={cancelJob} style={{ padding: '10px 14px', background: '#d93025', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>✕ Cancel</button>
          )}
        </section>

        {/* Progress */}
        {(status === 'sending' || status === 'cooldown' || status === 'completed') && (
          <section>
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>📈 Progress</div>
            <div style={{ background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden', height: '8px', marginBottom: '6px' }}>
              <div style={{ height: '100%', background: mode === 'email' ? '#1a73e8' : '#25d366', width: `${progressPct}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '6px' }}>
              {progress.current} / {progress.total} &nbsp;|&nbsp; ✅ {progress.sent} &nbsp;|&nbsp; ❌ {progress.failed}
            </div>
            <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '11px', border: '1px solid #eee', borderRadius: '4px', padding: '6px' }}>
              {logs.slice(-50).map((log, i) => (
                <div key={i} style={{ color: log.status === 'success' ? '#137333' : log.status === 'error' ? '#c5221f' : '#777', marginBottom: '2px' }}>
                  {log.status === 'success' ? '✓' : log.status === 'error' ? '✗' : '—'} {log.recipient}{log.message ? ` — ${log.message}` : ''}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Summary */}
        {summary && (
          <section style={{ background: '#e6f4ea', border: '1px solid #a8d5b5', borderRadius: '6px', padding: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>✅ Send Complete</div>
            <div>Sent: <b>{summary.sent}</b> &nbsp; Failed: <b>{summary.failed}</b> &nbsp; Skipped: <b>{summary.skipped}</b></div>
          </section>
        )}
      </div>
    </div>
  );
}
