import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/payment/notify/'],
      },
    ],
    sitemap: 'https://coshub.example.com/sitemap.xml',
  };
}
