import React, { useEffect, useState } from 'react';
import { sendToBackground } from '../lib/messaging';
import type { ExtensionSettings } from '../lib/storage';
import { DEFAULT_SETTINGS } from '../lib/storage';

export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{ delay?: string; batchSize?: string }>({});

  useEffect(() => {
    sendToBackground<ExtensionSettings>('GET_SETTINGS').then(setSettings).catch(() => {});
  }, []);

  async function handleSave() {
    const errors: { delay?: string; batchSize?: string } = {};
    if (settings.customDelaySeconds < 3) errors.delay = 'Delay must be at least 3 seconds.';
    if (settings.batchSize < 5) errors.batchSize = 'Batch size must be at least 5.';
    if (Object.keys(errors).length > 0) { setValidationErrors(errors); return; }
    setValidationErrors({});
    await sendToBackground('SAVE_SETTINGS', settings as unknown as Record<string, unknown>);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function field(label: string, node: React.ReactNode, error?: string) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', color: '#a1a1aa' }}>{label}</label>
        {node}
        {error && <div style={{ color: '#ff3b30', fontSize: '12px', marginTop: '3px' }}>{error}</div>}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '24px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif', fontSize: '14px', background: '#0a0a0a', color: '#fafafa', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
        <svg width="24" height="24" viewBox="0 0 72 72" fill="none">
          <path d="M36 12L60 24L36 36L12 24L36 12Z" fill="#10b981" opacity="0.9"/>
          <path d="M60 32L36 44L12 32" stroke="#34d399" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M60 42L36 54L12 42" stroke="#6ee7b7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h1 style={{ fontSize: '20px', margin: 0 }}>Send<span style={{ color: '#34d399' }}>Stack</span> — Options</h1>
      </div>

      {field('Default Mode', (
        <select value={settings.defaultMode} onChange={(e) => setSettings({ ...settings, defaultMode: e.target.value as ExtensionSettings['defaultMode'] })} style={{ width: '100%', padding: '6px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '6px' }}>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      ))}

      {field('Delay Preset', (
        <select value={settings.delayPreset} onChange={(e) => setSettings({ ...settings, delayPreset: e.target.value as ExtensionSettings['delayPreset'] })} style={{ width: '100%', padding: '6px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '6px' }}>
          <option value="fast">Fast (5 s)</option>
          <option value="normal">Normal (10 s)</option>
          <option value="safe">Safe (15 s)</option>
          <option value="custom">Custom</option>
        </select>
      ))}

      {settings.delayPreset === 'custom' && field('Custom Delay (seconds, min 3)', (
        <input type="number" min={3} max={60} value={settings.customDelaySeconds}
          onChange={(e) => setSettings({ ...settings, customDelaySeconds: Number(e.target.value) })}
          style={{ width: '100%', padding: '6px', background: '#171717', color: '#fafafa', border: '1px solid', borderColor: validationErrors.delay ? '#ff3b30' : '#262626', borderRadius: '6px' }} />
      ), validationErrors.delay)}

      {field('Random Jitter', (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a1a1aa' }}>
          <input type="checkbox" checked={settings.jitterEnabled} onChange={(e) => setSettings({ ...settings, jitterEnabled: e.target.checked })} />
          Enable ±30–50% random delay variation
        </label>
      ))}

      {field('Batch Size (messages per batch, min 5)', (
        <input type="number" min={5} max={100} value={settings.batchSize}
          onChange={(e) => setSettings({ ...settings, batchSize: Number(e.target.value) })}
          style={{ width: '100%', padding: '6px', background: '#171717', color: '#fafafa', border: '1px solid', borderColor: validationErrors.batchSize ? '#ff3b30' : '#262626', borderRadius: '6px' }} />
      ), validationErrors.batchSize)}

      {field('Batch Cool-down (seconds)', (
        <input type="number" min={10} max={600} value={settings.cooldownSeconds}
          onChange={(e) => setSettings({ ...settings, cooldownSeconds: Number(e.target.value) })}
          style={{ width: '100%', padding: '6px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '6px' }} />
      ))}

      {field('Daily Message Limit', (
        <input type="number" min={1} max={1000} value={settings.dailyLimit}
          onChange={(e) => setSettings({ ...settings, dailyLimit: Number(e.target.value) })}
          style={{ width: '100%', padding: '6px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '6px' }} />
      ))}

      {field('Spin Syntax', (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#a1a1aa' }}>
          <input type="checkbox" checked={settings.spinSyntaxEnabled} onChange={(e) => setSettings({ ...settings, spinSyntaxEnabled: e.target.checked })} />
          Enable spin syntax {'{A|B|C}'}
        </label>
      ))}

      {field('Sidebar Position', (
        <select value={settings.sidebarPosition} onChange={(e) => setSettings({ ...settings, sidebarPosition: e.target.value as ExtensionSettings['sidebarPosition'] })} style={{ width: '100%', padding: '6px', background: '#171717', color: '#fafafa', border: '1px solid #262626', borderRadius: '6px' }}>
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      ))}

      <button onClick={handleSave} style={{ padding: '10px 24px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '15px' }}>
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
