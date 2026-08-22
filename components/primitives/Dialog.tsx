import React, { forwardRef, useCallback, useRef } from 'react';
import { useDialogFocus } from '../../hooks/useDialogFocus';

export interface DialogProps extends React.HTMLAttributes<HTMLDivElement> {
  titleId: string;
  onClose: () => void;
  backdropLabel?: string;
  overlayClassName?: string;
  panelClassName?: string;
  placement?: 'center' | 'responsive-sheet';
}

const placementClass = {
  center: 'items-center',
  'responsive-sheet': 'items-end md:items-center',
} as const;

export const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  ({ titleId, onClose, backdropLabel, overlayClassName = 'z-[90]', panelClassName = '', placement = 'responsive-sheet', className = '', children, ...props }, forwardedRef) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    const setDialogRef = useCallback((node: HTMLDivElement | null) => {
      dialogRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    }, [forwardedRef]);
    useDialogFocus(dialogRef, onClose);

    return (
      <div className={`oa-root fixed inset-0 flex justify-center p-4 ${placementClass[placement]} ${overlayClassName}`.trim()}>
        {backdropLabel ? (
          <button type="button" className="absolute inset-0 bg-ink/80 cursor-default" onClick={onClose} aria-label={backdropLabel} />
        ) : (
          <div className="absolute inset-0 bg-ink/80" aria-hidden="true" />
        )}
        <div
          ref={setDialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className={`relative w-full bg-broadcast-white ring-[3px] ring-ink ${panelClassName} ${className}`.trim()}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  },
);

Dialog.displayName = 'Dialog';
