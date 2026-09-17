import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { ContextNotch, AssignmentRing } from '../../src/design/primitives/ContextNotch';

/** Only loaded by the browser regression test; never an application route. */
export function mountRefinementNotch() {
  const host = document.createElement('div');
  host.id = 'refinement-notch-test';
  host.style.cssText = 'position:fixed;inset:0;z-index:100;background:var(--g-ground);';
  document.body.append(host);
  const root = createRoot(host);
  function Fixture() {
    const [assigned, setAssigned] = useState(20);
    return <><ContextNotch label="Refinement notch" summary="Measured test board" modules={[
      { id: 'board', label: 'Board', reading: <AssignmentRing assigned={assigned} />, detail: <p>Assigned board details</p> },
      { id: 'payments', label: 'Payments', detail: <p>Private payment detail with longer text that wraps naturally without scaling. Counts are squares. Private payment detail with longer text that wraps naturally without scaling.</p> },
      { id: 'share', label: 'Share with your organization', detail: <p>Existing sharing options.</p> },
    ]} /><button onClick={() => setAssigned(72)}>Update assignment fixture</button></>;
  }
  flushSync(() => root.render(<Fixture />));
  return {
    activate: (label: string) => flushSync(() => {
      const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(node => node.getAttribute('aria-label') === label || node.textContent === label);
      if (!button) throw new Error(`Missing fixture control ${label}`);
      button.click();
    }),
    destroy: () => { root.unmount(); host.remove(); },
  };
}
