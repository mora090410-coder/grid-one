export const SITE_NAME = 'GridOne';
export const SITE_URL = 'https://www.getgridone.com';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export type PublicRouteMetadata = {
  path: string;
  title: string;
  description: string;
  type: 'website' | 'article';
  noIndex?: boolean;
  schema: Record<string, unknown> | Array<Record<string, unknown>>;
};

const organization = {
  '@type': 'Organization',
  name: SITE_NAME,
  url: `${SITE_URL}/`,
  logo: `${SITE_URL}/icons/gridone-icon-256.png`,
};

const websiteRoute = (
  path: string,
  title: string,
  description: string,
  options: { noIndex?: boolean; schemaType?: string } = {},
): PublicRouteMetadata => ({
  path,
  title,
  description,
  type: 'website',
  noIndex: options.noIndex,
  schema: {
    '@type': options.schemaType ?? 'WebPage',
    name: title,
    description,
    url: new URL(path, `${SITE_URL}/`).toString(),
  },
});

const articleRoute = (
  path: string,
  title: string,
  description: string,
): PublicRouteMetadata => ({
  path,
  title,
  description,
  type: 'article',
  schema: {
    '@type': 'Article',
    headline: title,
    description,
    mainEntityOfPage: new URL(path, `${SITE_URL}/`).toString(),
    author: organization,
    publisher: organization,
  },
});

export const PUBLIC_ROUTE_METADATA: PublicRouteMetadata[] = [
  {
    path: '/',
    title: 'Football Squares App for Super Bowl Squares, Fundraisers, and Group Pools | GridOne',
    description: 'Run football squares and Super Bowl squares online with GridOne. Built for fundraisers, office pools, watch parties, and community groups that want one clean live board link.',
    type: 'website',
    schema: [
      organization,
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: `${SITE_URL}/`,
      },
      {
        '@type': 'SoftwareApplication',
        name: SITE_NAME,
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Any',
        description: 'Run football squares and Super Bowl squares online for fundraisers, office pools, watch parties, and community groups.',
        offers: {
          '@type': 'Offer',
          price: '4.99',
          priceCurrency: 'USD',
        },
      },
    ],
  },
  websiteRoute(
    '/demo',
    'Football Squares Demo Board | GridOne',
    'Open a complete GridOne demonstration board with synthetic football squares, score context, winner scenarios, and no viewer account.',
    { noIndex: true },
  ),
  websiteRoute(
    '/login',
    'Organizer sign in | GridOne',
    'Sign in to create and manage GridOne football squares boards.',
    { noIndex: true },
  ),
  websiteRoute(
    '/paid',
    'Checkout status | GridOne',
    'Confirming your GridOne 2026 season-pass payment and board activation.',
    { noIndex: true },
  ),
  websiteRoute(
    '/articles',
    'GridOne Articles and Guides | Football Squares, Fundraisers, and Super Bowl Squares',
    'GridOne guides for football squares, Super Bowl squares, fundraisers, office pools, and digital board alternatives.',
    { schemaType: 'CollectionPage' },
  ),
  articleRoute(
    '/articles/how-to-run-super-bowl-squares',
    'How to Run Super Bowl Squares Online | GridOne',
    'Learn how to run Super Bowl squares online, share one live board link, and avoid paper-board confusion for fundraisers, offices, and watch parties.',
  ),
  articleRoute(
    '/articles/run-your-pool-alternative',
    'RunYourPool Alternative for Football Squares | GridOne',
    'GridOne is a modern RunYourPool alternative for football squares, with a cleaner mobile viewer experience, live scoring, and simpler sharing.',
  ),
  articleRoute(
    '/articles/football-squares-fundraiser',
    'Football Squares Fundraiser Ideas That Are Easier to Run Online | GridOne',
    'Use GridOne to run a football squares fundraiser online for booster clubs, youth sports teams, churches, and community groups without poster board chaos.',
  ),
  articleRoute(
    '/articles/office-super-bowl-squares',
    'Office Super Bowl Squares Without Spreadsheet Chaos | GridOne',
    'Run office Super Bowl squares online with one clean live board link, easier score tracking, and fewer payout disputes.',
  ),
  articleRoute(
    '/articles/how-football-squares-work',
    'How Football Squares Work, Simple Rules and Setup | GridOne',
    'Learn how football squares work, how winners are determined, and how to set up a clean online football squares board.',
  ),
  articleRoute(
    '/articles/youth-sports-football-squares-fundraiser',
    'Youth Sports Football Squares Fundraiser Guide | GridOne',
    'Run a youth sports football squares fundraiser with less parent confusion, cleaner board sharing, and one live mobile-friendly link.',
  ),
  articleRoute(
    '/articles/super-bowl-squares-ideas',
    'Super Bowl Squares Ideas for Fundraisers, Offices, and Parties | GridOne',
    'Super Bowl squares ideas that make the board easier to run, easier to share, and more fun for fundraisers, office pools, and parties.',
  ),
  articleRoute(
    '/articles/digital-football-squares-board-vs-paper',
    'Digital Football Squares Board vs Paper Board | GridOne',
    'Compare a digital football squares board to a paper board, poster board, or screenshot-based setup for easier sharing and cleaner game-day updates.',
  ),
  articleRoute(
    '/articles/booster-club-football-squares',
    'Booster Club Football Squares Fundraiser Guide | GridOne',
    'Use football squares as a booster club fundraiser with cleaner board sharing, clearer organizer control, and one live link for supporters.',
  ),
  articleRoute(
    '/articles/church-school-football-squares-fundraiser',
    'Church and School Football Squares Fundraiser Ideas | GridOne',
    'Church and school football squares fundraiser ideas with cleaner sharing, simpler organizer flow, and one live board link for supporters.',
  ),
  articleRoute(
    '/articles/nfl-opening-week-squares-pool',
    'NFL Opening Week Squares Pool Ideas | GridOne',
    'NFL opening week squares pool ideas for offices, watch parties, and community groups that want a cleaner digital board and live viewer link.',
  ),
  articleRoute(
    '/articles/football-squares-app',
    'Football Squares App for Fundraisers, Offices, and Watch Parties | GridOne',
    'GridOne is a football squares app built for fundraisers, office pools, watch parties, and community groups that want one clean live board link.',
  ),
  websiteRoute(
    '/privacy',
    'Privacy Policy | GridOne',
    'How GridOne handles organizer accounts, football squares board data, optional winner emails, and beta image scanning.',
  ),
  websiteRoute(
    '/terms',
    'Terms of Service | GridOne',
    'Terms for using GridOne to create, share, and track football squares boards.',
  ),
];

export const INDEXABLE_PUBLIC_ROUTE_METADATA = PUBLIC_ROUTE_METADATA.filter(
  (route) => !route.noIndex,
);

export const getPublicRouteMetadata = (path: string): PublicRouteMetadata => {
  const metadata = PUBLIC_ROUTE_METADATA.find((route) => route.path === path);
  if (!metadata) {
    throw new Error(`Missing public route metadata for ${path}`);
  }
  return metadata;
};
