import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy',
    description: 'Privacy policy for SendStack bulk messaging platform and Chrome extension. Learn how your data is handled — no tracking, no analytics, fully offline.',
    alternates: {
        canonical: '/privacy',
    },
    openGraph: {
        title: 'Privacy Policy — SendStack',
        description: 'Privacy policy for SendStack. No tracking, no analytics, fully offline. Your data stays on your device.',
        url: 'https://sender.qobouli.com/privacy',
    },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
    return children;
}
