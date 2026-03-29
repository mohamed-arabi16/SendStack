import React, { useEffect, useState } from 'react';
import { sendToBackground } from '../lib/messaging';

export default function Popup() {
  const [dailyCount, setDailyCount] = useState({ sent: 0, limit: 200 });
  const [currentSite, setCurrentSite] = useState<'gmail' | 'whatsapp' | 'other'>('other');

  useEffect(() => {
    sendToBackground<{ sent: number; limit: number }>('GET_DAILY_COUNT').then(setDailyCount).catch(() => {});
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
    <div style={{ width: '280px', padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", sans-serif', fontSize: '13px', background: '#0a0a0a', color: '#fafafa' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <svg width="20" height="20" viewBox="0 0 72 72" fill="none">
          <path d="M36 12L60 24L36 36L12 24L36 12Z" fill="#10b981" opacity="0.9"/>
          <path d="M60 32L36 44L12 32" stroke="#34d399" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M60 42L36 54L12 42" stroke="#6ee7b7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: '16px' }}>Send<span style={{ color: '#34d399' }}>Stack</span></span>
      </div>

      {/* Site status */}
      <div style={{ background: '#171717', borderRadius: '8px', padding: '10px', marginBottom: '12px', border: '1px solid #262626' }}>
        <div style={{ fontWeight: 600, marginBottom: '6px', color: '#a1a1aa' }}>Current Site</div>
        {currentSite === 'gmail' && <div style={{ color: '#10b981' }}>You are on Gmail — panel is active</div>}
        {currentSite === 'whatsapp' && <div style={{ color: '#34d399' }}>You are on WhatsApp Web — panel is active</div>}
        {currentSite === 'other' && (
          <div>
            <div style={{ color: '#71717a', marginBottom: '6px' }}>Not on Gmail or WhatsApp Web</div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={openGmail} style={{ flex: 1, padding: '5px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Open Gmail</button>
              <button onClick={openWhatsApp} style={{ flex: 1, padding: '5px', background: '#059669', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Open WhatsApp</button>
            </div>
          </div>
        )}
      </div>

      {/* Daily stats */}
      <div style={{ background: '#171717', borderRadius: '8px', padding: '10px', marginBottom: '12px', border: '1px solid #262626' }}>
        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#a1a1aa' }}>Today&apos;s Usage</div>
        <div style={{ background: '#262626', borderRadius: '4px', overflow: 'hidden', height: '6px', marginBottom: '4px' }}>
          <div style={{ height: '100%', background: '#10b981', width: `${Math.min(100, (dailyCount.sent / dailyCount.limit) * 100)}%` }} />
        </div>
        <div style={{ fontSize: '12px', color: '#71717a' }}>{dailyCount.sent} / {dailyCount.limit} messages sent today</div>
      </div>

      {/* Options link */}
      <button onClick={openOptions} style={{ width: '100%', padding: '8px', background: '#171717', border: '1px solid #262626', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: '#a1a1aa' }}>
        Open Options
      </button>
    </div>
  );
}
