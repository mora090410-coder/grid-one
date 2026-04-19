import React from 'react';
import { Link } from 'react-router-dom';

type LinkItem = {
  to: string;
  label: string;
  primary?: boolean;
};

type Props = {
  title?: string;
  links: LinkItem[];
};

export const ArticleCTA: React.FC<Props> = ({ title = 'Related guides', links }) => {
  return (
    <div className="mt-16 rounded-3xl bg-white/5 p-8 ring-1 ring-white/10">
      <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={link.primary
              ? 'rounded-full bg-cardinal px-5 py-3 text-sm font-semibold text-white hover:brightness-110 transition-all text-center'
              : 'rounded-full bg-white/5 px-5 py-3 text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10 transition-all text-center'}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
};
