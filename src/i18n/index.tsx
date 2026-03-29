'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import en from './en.json';
import ar from './ar.json';
import tr from './tr.json';

export type Locale = 'en' | 'ar' | 'tr';

type Translations = typeof en;

const translations: Record<Locale, Translations> = { en, ar, tr };

const RTL_LOCALES: Locale[] = ['ar'];

interface I18nContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string) => string;
    dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getNestedValue(obj: Record<string, unknown>, path: string): string {
    const keys = path.split('.');
    let current: unknown = obj;
    for (const key of keys) {
        if (current == null || typeof current !== 'object') return path;
        current = (current as Record<string, unknown>)[key];
    }
    return typeof current === 'string' ? current : path;
}

function getInitialLocale(): Locale {
    if (typeof window === 'undefined') return 'en';
    const saved = localStorage.getItem('sendstack-locale');
    if (saved && saved in translations) return saved as Locale;
    const browserLang = navigator.language.split('-')[0];
    if (browserLang in translations) return browserLang as Locale;
    return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setLocaleState(getInitialLocale());
        setMounted(true);
    }, []);

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem('sendstack-locale', newLocale);
        document.documentElement.lang = newLocale;
        document.documentElement.dir = RTL_LOCALES.includes(newLocale) ? 'rtl' : 'ltr';
    };

    useEffect(() => {
        if (mounted) {
            document.documentElement.lang = locale;
            document.documentElement.dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
        }
    }, [locale, mounted]);

    const t = (key: string): string => {
        return getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
    };

    const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

    return (
        <I18nContext.Provider value={{ locale, setLocale, t, dir }}>
            {children}
        </I18nContext.Provider>
    );
}

export function useTranslation() {
    const context = useContext(I18nContext);
    if (!context) throw new Error('useTranslation must be used within LanguageProvider');
    return context;
}

export function LanguageSwitcher() {
    const { locale, setLocale } = useTranslation();

    const labels: Record<Locale, string> = {
        en: 'EN',
        ar: 'AR',
        tr: 'TR',
    };

    return (
        <div className="lang-switcher">
            {(Object.keys(labels) as Locale[]).map((lang) => (
                <button
                    key={lang}
                    className={`lang-btn ${locale === lang ? 'lang-btn--active' : ''}`}
                    onClick={() => setLocale(lang)}
                >
                    {labels[lang]}
                </button>
            ))}
        </div>
    );
}
