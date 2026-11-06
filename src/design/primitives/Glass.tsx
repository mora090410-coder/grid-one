import React from 'react';

type Padding = 'none' | 'md' | 'lg';
const PAD: Record<Padding, string> = { none: '', md: 'p-5', lg: 'p-7' };

export interface GlassProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'figure';
  padding?: Padding;
}

/** Translucent panel. Fill, hairline, and shadow come from the active base. */
export const Glass = React.forwardRef<HTMLElement, GlassProps>(function Glass(
  { as: Tag = 'div', padding = 'md', className = '', ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={`g1-glass bg-panel border border-hairline rounded-card backdrop-blur-[var(--g-blur)] shadow-[var(--g-shadow)] transition-[background-color] duration-[var(--g-dur-state)] ease-[var(--g-ease-state)] ${PAD[padding]} ${className}`.trim()}
      {...rest}
    />
  );
});
