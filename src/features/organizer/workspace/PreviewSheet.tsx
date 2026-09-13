import React from 'react';
import { Sheet, CapsuleButton } from '../../../design/primitives';

export interface PreviewSheetProps {
  open: boolean;
  isShared?: boolean;
  onClose: () => void;
  canPublish: boolean;
  onReviewPublish: () => void;
  children: React.ReactNode;
}

/** Full-height private preview of the board before it is shared. */
export default function PreviewSheet({ open, isShared = false, onClose, canPublish, onReviewPublish, children }: PreviewSheetProps) {
  return (
    <Sheet open={open} onClose={onClose} title={isShared ? 'Preview final board' : 'Private preview — sharing is off'} height="full" width="wide" solidSurface
      footer={<CapsuleButton type="button" className="w-full" disabled={!canPublish} onClick={onReviewPublish}>
        {isShared ? 'Review and lock numbers' : 'Review and publish'}
      </CapsuleButton>}
    >
      <div data-testid="preview-scroll">{children}</div>
    </Sheet>
  );
}
