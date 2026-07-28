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
    <div className="mt-16 bg-broadcast-white ring-[3px] ring-inset ring-ink p-8">
      <h2 className="oa-headline !text-2xl text-ink">{title}</h2>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={link.primary
              ? 'oa-btn bg-cardinal text-broadcast-white hover:bg-cardinal-deep text-center'
              : 'oa-btn bg-broadcast-white text-ink ring-1 ring-inset ring-ink hover:bg-newsprint text-center'}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
};
