import React from 'react';
import { SitePage } from '../src/features/site';

/**
 * The sign-in card on the site shell, so account pages carry the same banner
 * and main landmarks as every other public route. The header's own Sign in
 * link is dropped here: these pages are that link's destination. The main is
 * short, so it holds its own height and centres the card inside it.
 */
export const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <SitePage
    width="prose"
    withFooter={false}
    hideSignIn
    mainProps={{ className: 'flex min-h-[calc(100dvh-172px)] items-center justify-center' }}
  >
    {children}
  </SitePage>
);
