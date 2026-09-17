import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { AssignmentRing } from '../../src/design/primitives/ContextNotch';

/** Browser-only test harness; never imported by application routes. */
export function mountReadingTest() {
  const host = document.createElement('div');
  host.id = 'notch-reading-test';
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() => root.render(<AssignmentRing assigned={20} />));
  return {
    update: () => flushSync(() => root.render(<AssignmentRing assigned={72} />)),
    destroy: () => { root.unmount(); host.remove(); },
  };
}
