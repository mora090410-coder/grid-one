import { useEffect } from 'react';

const SITE_NAME = 'GridOne';
const SITE_URL = 'https://www.getgridone.com';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

type Props = {
  title: string;
  description: string;
  path?: string;
  type?: 'website' | 'article';
  image?: string;
  schema?: Record<string, any> | Array<Record<string, any>>;
};

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element!.setAttribute(key, value));
}

function upsertLink(selector: string, attrs: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => element!.setAttribute(key, value));
}

export function PageMetadata({
  title,
  description,
  path = '/',
  type = 'website',
  image = DEFAULT_IMAGE,
  schema,
}: Props) {
  useEffect(() => {
    const canonicalUrl = new URL(path, `${SITE_URL}/`).toString();
    document.title = title;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalUrl });

    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: type });
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image });

    upsertMeta('meta[name="twitter:card"], meta[property="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:url"], meta[property="twitter:url"]', { name: 'twitter:url', content: canonicalUrl });
    upsertMeta('meta[name="twitter:title"], meta[property="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"], meta[property="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"], meta[property="twitter:image"]', { name: 'twitter:image', content: image });

    let schemaTag = document.head.querySelector('script[data-gridone-schema="page"]') as HTMLScriptElement | null;
    if (schema) {
      if (!schemaTag) {
        schemaTag = document.createElement('script');
        schemaTag.type = 'application/ld+json';
        schemaTag.setAttribute('data-gridone-schema', 'page');
        document.head.appendChild(schemaTag);
      }
      const graph = Array.isArray(schema) ? schema : [schema];
      schemaTag.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    } else if (schemaTag) {
      schemaTag.remove();
    }

    return () => {
      const currentTag = document.head.querySelector('script[data-gridone-schema="page"]');
      if (currentTag) currentTag.remove();
    };
  }, [title, description, path, type, image, schema]);

  return null;
}
