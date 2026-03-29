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
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {
        languages: {
          en: `${SITE_URL}/about`,
          ar: `${SITE_URL}/about`,
          tr: `${SITE_URL}/about`,
        },
      },
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {
        languages: {
          en: `${SITE_URL}/faq`,
          ar: `${SITE_URL}/faq`,
          tr: `${SITE_URL}/faq`,
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
