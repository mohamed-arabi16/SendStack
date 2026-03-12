import React, { useEffect, useState } from 'react';
import { sendToBackground } from '../lib/messaging';
import type { ExtensionSettings } from '../lib/storage';
import { DEFAULT_SETTINGS } from '../lib/storage';

export default function Options() {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    sendToBackground<ExtensionSettings>('GET_SETTINGS').then(setSettings).catch(console.error);
  }, []);

  async function handleSave() {
    if (settings.customDelaySeconds < 3) { alert('Delay must be at least 3 seconds.'); return; }
    if (settings.batchSize < 5) { alert('Batch size must be at least 5.'); return; }
    await sendToBackground('SAVE_SETTINGS', settings as unknown as Record<string, unknown>);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function field(label: string, node: React.ReactNode) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px' }}>{label}</label>
        {node}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', padding: '24px', fontFamily: 'sans-serif', fontSize: '14px' }}>
      <h1 style={{ fontSize: '20px', marginBottom: '24px' }}>⚙️ Bulk Sender — Options</h1>

      {field('Default Mode', (
        <select value={settings.defaultMode} onChange={(e) => setSettings({ ...settings, defaultMode: e.target.value as ExtensionSettings['defaultMode'] })} style={{ width: '100%', padding: '6px' }}>
          <option value="email">Email</option>
          <option value="whatsapp">WhatsApp</option>
        </select>
      ))}

      {field('Delay Preset', (
        <select value={settings.delayPreset} onChange={(e) => setSettings({ ...settings, delayPreset: e.target.value as ExtensionSettings['delayPreset'] })} style={{ width: '100%', padding: '6px' }}>
          <option value="fast">Fast (5 s)</option>
          <option value="normal">Normal (10 s)</option>
          <option value="safe">Safe (15 s)</option>
          <option value="custom">Custom</option>
        </select>
      ))}

      {settings.delayPreset === 'custom' && field('Custom Delay (seconds, min 3)', (
        <input type="number" min={3} max={60} value={settings.customDelaySeconds}
          onChange={(e) => setSettings({ ...settings, customDelaySeconds: Number(e.target.value) })}
          style={{ width: '100%', padding: '6px' }} />
      ))}

      {field('Random Jitter', (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked={settings.jitterEnabled} onChange={(e) => setSettings({ ...settings, jitterEnabled: e.target.checked })} />
          Enable ±30–50% random delay variation
        </label>
      ))}

      {field('Batch Size (messages per batch, min 5)', (
        <input type="number" min={5} max={100} value={settings.batchSize}
          onChange={(e) => setSettings({ ...settings, batchSize: Number(e.target.value) })}
          style={{ width: '100%', padding: '6px' }} />
      ))}

      {field('Batch Cool-down (seconds)', (
        <input type="number" min={10} max={600} value={settings.cooldownSeconds}
          onChange={(e) => setSettings({ ...settings, cooldownSeconds: Number(e.target.value) })}
          style={{ width: '100%', padding: '6px' }} />
      ))}

      {field('Daily Message Limit', (
        <input type="number" min={1} max={1000} value={settings.dailyLimit}
          onChange={(e) => setSettings({ ...settings, dailyLimit: Number(e.target.value) })}
          style={{ width: '100%', padding: '6px' }} />
      ))}

      {field('Spin Syntax', (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked={settings.spinSyntaxEnabled} onChange={(e) => setSettings({ ...settings, spinSyntaxEnabled: e.target.checked })} />
          Enable spin syntax {'{A|B|C}'}
        </label>
      ))}

      {field('Sidebar Position', (
        <select value={settings.sidebarPosition} onChange={(e) => setSettings({ ...settings, sidebarPosition: e.target.value as ExtensionSettings['sidebarPosition'] })} style={{ width: '100%', padding: '6px' }}>
          <option value="right">Right</option>
          <option value="left">Left</option>
        </select>
      ))}

      <button onClick={handleSave} style={{ padding: '10px 24px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '15px' }}>
        {saved ? '✅ Saved!' : '💾 Save Settings'}
      </button>
    </div>
  );
}
