import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Dashboard — Send Bulk Emails & WhatsApp',
    description: 'Upload your CSV, configure SMTP or WhatsApp, write your template with variables, and send personalized messages in bulk. Free and open-source.',
    robots: { index: false, follow: false },
    alternates: {
        canonical: '/dashboard',
    },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return children;
}
