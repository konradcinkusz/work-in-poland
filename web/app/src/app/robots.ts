import type { MetadataRoute } from 'next';
import { publicSiteUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const site = publicSiteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/oferty/*/aplikuj', '/konto', '/pracodawca', '/zgody', '/oauth/', '/reset-password', '/verify-email'] }],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
