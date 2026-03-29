import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'About',
    description: 'SendStack is a free, open-source bulk email and WhatsApp messaging platform built by Qobouli AI & Dev. Learn about our mission, features, and the team behind the tool.',
    alternates: {
        canonical: '/about',
    },
    openGraph: {
        title: 'About SendStack — Free Bulk Messaging Platform by Qobouli',
        description: 'Free, open-source bulk email and WhatsApp messaging. Built by Qobouli AI & Dev in Istanbul.',
        url: 'https://sender.qobouli.com/about',
    },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
    return children;
}
