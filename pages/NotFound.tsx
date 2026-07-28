import React from 'react';
import { Link } from 'react-router-dom';
import { PageMetadata } from '../components/seo/PageMetadata';

const NotFound: React.FC = () => (
  <main className="oa-root gdh-unavailable min-h-[100dvh]">
    <PageMetadata
      title="Page not found | GridOne"
      description="The GridOne page or board link you requested could not be found."
      path="/404"
      noIndex
    />
    <p className="gdh-kicker">404 · Off the board</p>
    <h1>This link does not point to a page.</h1>
    <p>Check the address, ask the organizer for a fresh board link, or return to GridOne.</p>
    <Link className="oa-btn oa-btn-primary" to="/">Return to GridOne</Link>
  </main>
);

export default NotFound;
