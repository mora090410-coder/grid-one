import React, { forwardRef } from 'react';

type ActionButtonVariant = 'primary' | 'cardinal' | 'ghost' | 'plain';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  busy?: boolean;
  fullWidth?: boolean;
}

const variantClass: Record<ActionButtonVariant, string> = {
  primary: 'oa-btn-primary',
  cardinal: 'oa-btn-cardinal',
  ghost: 'oa-btn-ghost',
  plain: 'bg-transparent text-ink border border-transparent',
};

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ variant = 'primary', busy = false, disabled = false, fullWidth = false, className = '', type = 'button', 'aria-busy': ariaBusy, ...props }, ref) => {
    const isDisabled = disabled || busy;
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={busy ? true : ariaBusy}
        className={`oa-btn min-h-11 min-w-11 focus-visible:outline-ink ${variantClass[variant]} ${fullWidth ? 'w-full' : ''} ${className}`.trim()}
      />
    );
  },
);

ActionButton.displayName = 'ActionButton';
