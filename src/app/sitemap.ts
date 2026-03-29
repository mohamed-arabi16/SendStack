import type { MetadataRoute } from 'next';

const SITE_URL = 'https://sender.qobouli.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
      alternates: {
        languages: {
          en: SITE_URL,
          ar: SITE_URL,
          tr: SITE_URL,
        },
      },
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
