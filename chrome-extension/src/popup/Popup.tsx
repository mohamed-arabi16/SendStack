import React, { useEffect, useState } from 'react';
import { sendToBackground } from '../lib/messaging';

export default function Popup() {
  const [dailyCount, setDailyCount] = useState({ sent: 0, limit: 200 });
  const [currentSite, setCurrentSite] = useState<'gmail' | 'whatsapp' | 'other'>('other');

  useEffect(() => {
    sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT').then(setDailyCount).catch(console.error);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      try {
        const parsed = new URL(tabs[0]?.url ?? '');
        if (parsed.hostname === 'mail.google.com') setCurrentSite('gmail');
        else if (parsed.hostname === 'web.whatsapp.com') setCurrentSite('whatsapp');
      } catch {
        // invalid URL — leave as 'other'
      }
    });
  }, []);

  function openGmail() { chrome.tabs.create({ url: 'https://mail.google.com' }); }
  function openWhatsApp() { chrome.tabs.create({ url: 'https://web.whatsapp.com' }); }
  function openOptions() { chrome.runtime.openOptionsPage(); }

  return (
    <div style={{ width: '280px', padding: '16px', fontFamily: 'sans-serif', fontSize: '13px' }}>
      <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '12px' }}>SendStack</div>

      {/* Site status */}
      <div style={{ background: '#f5f5f5', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 600, marginBottom: '6px' }}>Current Site</div>
        {currentSite === 'gmail' && <div style={{ color: '#1a73e8' }}>✉ You are on Gmail — panel is active</div>}
        {currentSite === 'whatsapp' && <div style={{ color: '#25d366' }}>💬 You are on WhatsApp Web — panel is active</div>}
        {currentSite === 'other' && (
          <div>
            <div style={{ color: '#777', marginBottom: '6px' }}>Not on Gmail or WhatsApp Web</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={openGmail} style={{ flex: 1, padding: '5px', background: '#1a73e8', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Open Gmail</button>
              <button onClick={openWhatsApp} style={{ flex: 1, padding: '5px', background: '#25d366', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Open WhatsApp</button>
            </div>
          </div>
        )}
      </div>

      {/* Daily stats */}
      <div style={{ background: '#f5f5f5', borderRadius: '6px', padding: '10px', marginBottom: '12px' }}>
        <div style={{ fontWeight: 600, marginBottom: '4px' }}>📊 Today&apos;s Usage</div>
        <div style={{ background: '#e0e0e0', borderRadius: '4px', overflow: 'hidden', height: '6px', marginBottom: '4px' }}>
          <div style={{ height: '100%', background: '#1a73e8', width: `${Math.min(100, (dailyCount.sent / dailyCount.limit) * 100)}%` }} />
        </div>
        <div style={{ fontSize: '12px', color: '#555' }}>{dailyCount.sent} / {dailyCount.limit} messages sent today</div>
      </div>

      {/* Options link */}
      <button onClick={openOptions} style={{ width: '100%', padding: '8px', background: '#f5f5f5', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
        ⚙️ Open Options
      </button>
    </div>
  );
}
