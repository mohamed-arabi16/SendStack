const SITE_URL = "https://sender.qobouli.com";

const softwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "SendStack by Qobouli",
  "alternateName": ["SendStack", "سيند ستاك", "أداة إرسال جماعي"],
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "Email Marketing",
  "operatingSystem": "Web",
  "url": SITE_URL,
  "description": "Send personalized bulk emails and WhatsApp messages from CSV. Supports Gmail, iCloud+, custom SMTP, spin syntax, and anti-ban delays. Free, open-source, fully offline.",
  "inLanguage": ["en", "ar", "tr"],
  "offers": {
    "@type": "Offer",
    "name": "Free",
    "price": "0",
    "priceCurrency": "USD",
    "description": "Completely free and open-source"
  },
  "author": {
    "@type": "Organization",
    "name": "Qobouli AI & Dev",
    "url": "https://qobouli.com"
  },
  "featureList": [
    "Bulk email sending via SMTP (Gmail, iCloud+, custom domains)",
    "Bulk WhatsApp messaging via QR pairing",
    "CSV upload with auto-detected columns",
    "Template variables with personalization",
    "Spin syntax for message variation",
    "Anti-ban delays, jitter, batch cool-downs",
    "Real-time progress tracking and logs",
    "Chrome extension for Gmail & WhatsApp Web",
    "100% offline — no data leaves your device",
    "Multilingual: English, Arabic, Turkish"
  ]
};

const webSite = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "SendStack",
  "alternateName": ["SendStack by Qobouli", "سيند ستاك"],
  "url": SITE_URL,
  "description": "Free bulk email and WhatsApp messaging platform with CSV personalization",
  "inLanguage": ["en", "ar", "tr"],
  "publisher": {
    "@type": "Organization",
    "name": "Qobouli AI & Dev",
    "url": "https://qobouli.com"
  }
};

const faqPage = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Is SendStack free?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes, SendStack is completely free and open-source. No subscriptions, no hidden fees."
      }
    },
    {
      "@type": "Question",
      "name": "هل سيند ستاك مجاني؟",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "نعم، سيند ستاك مجاني بالكامل ومفتوح المصدر. بدون اشتراكات أو رسوم مخفية."
      }
    },
    {
      "@type": "Question",
      "name": "Does SendStack store my data?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. All CSV data, SMTP credentials, and messages stay on your device. SendStack makes no outbound network requests. No analytics, no tracking."
      }
    },
    {
      "@type": "Question",
      "name": "هل يخزن سيند ستاك بياناتي؟",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "لا. جميع بيانات CSV وبيانات SMTP والرسائل تبقى على جهازك. لا يرسل سيند ستاك أي طلبات شبكة خارجية. بدون تحليلات أو تتبع."
      }
    },
    {
      "@type": "Question",
      "name": "What email providers does SendStack support?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "SendStack works with any SMTP provider including Gmail, iCloud+, Outlook, Yahoo, and custom domains. Just enter your SMTP host, port, username, and password."
      }
    },
    {
      "@type": "Question",
      "name": "Can SendStack send WhatsApp messages?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. SendStack supports bulk WhatsApp messaging via QR code pairing with WhatsApp Web. It includes anti-ban features like delays, jitter, batch cool-downs, and daily limits."
      }
    },
    {
      "@type": "Question",
      "name": "What is spin syntax?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Spin syntax like {Hello|Hi|Hey} randomly selects one variant per recipient, making each message unique and reducing spam detection."
      }
    },
    {
      "@type": "Question",
      "name": "SendStack ücretsiz mi?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Evet, SendStack tamamen ücretsiz ve açık kaynaklıdır. Abonelik veya gizli ücret yoktur."
      }
    }
  ]
};

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Qobouli AI & Dev",
  "url": "https://qobouli.com",
  "logo": `${SITE_URL}/logo.svg`,
  "description": "AI & software development division of Qobouli. Building tools for productivity, education, and communication.",
  "foundingLocation": {
    "@type": "Place",
    "name": "Istanbul, Turkey"
  }
};

export default function JsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplication) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSite) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPage) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
    </>
  );
}
