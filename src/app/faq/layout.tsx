import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'FAQ',
    description: 'Frequently asked questions about SendStack — bulk email and WhatsApp messaging platform. Is it free? Does it store data? What SMTP providers work? أسئلة شائعة عن سيند ستاك.',
    alternates: {
        canonical: '/faq',
    },
    openGraph: {
        title: 'FAQ — SendStack Bulk Messaging Platform',
        description: 'Answers to common questions about SendStack: pricing, privacy, supported providers, WhatsApp safety, and more.',
        url: 'https://sender.qobouli.com/faq',
    },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
    return children;
}
