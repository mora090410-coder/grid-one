import React from 'react';
import { Eyebrow } from '../../design/primitives';
import { PageMetadata } from '../../../components/seo/PageMetadata';
import { SitePage } from './SitePage';

export const proseClasses = '[&_h2]:font-display [&_h2]:text-[28px] [&_h2]:leading-[1.1] [&_h2]:text-fg [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:font-ui [&_h3]:text-[19px] [&_h3]:font-semibold [&_h3]:text-fg [&_h3]:mt-8 [&_h3]:mb-3 [&_p]:font-ui [&_p]:text-[17px] [&_p]:leading-[1.6] [&_p]:text-fg-2 [&_p]:mb-5 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_li]:text-fg-2 [&_li]:leading-[1.6] [&_li]:mb-2 [&_a]:text-fg [&_a]:underline [&_a]:underline-offset-4 [&_strong]:text-fg';

export interface ArticleShellProps {
  tag: string;
  title: string;
  /** Visible h1 when the page's headline differs from its metadata title. Defaults to `title`. */
  heading?: string;
  lede: React.ReactNode;
  path: string;
  description: string;
  schema?: Record<string, any> | Array<Record<string, any>>;
  type?: 'website' | 'article';
  children: React.ReactNode;
  aside?: React.ReactNode;
}

export function ArticleShell({
  tag,
  title,
  heading,
  lede,
  path,
  description,
  schema,
  type = 'article',
  children,
  aside,
}: ArticleShellProps) {
  return (
    <SitePage width="prose">
      <PageMetadata title={title} description={description} path={path} type={type} schema={schema} />
      <div className="flex flex-col gap-4">
        <Eyebrow>{tag}</Eyebrow>
        <h1 className="font-display text-[40px] leading-[1.05] text-fg md:text-[52px]">{heading ?? title}</h1>
        <p className="font-ui text-[19px] leading-[1.5] text-fg-2">{lede}</p>
      </div>
      <article className={`mt-10 ${proseClasses}`}>{children}</article>
      {aside ? <aside className="mt-12">{aside}</aside> : null}
    </SitePage>
  );
}
