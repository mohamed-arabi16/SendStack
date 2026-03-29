import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Privacy Policy — SendStack',
    description: 'Privacy policy for the SendStack bulk messaging platform and Chrome extension.',
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
    return children;
}
