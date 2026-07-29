import React from 'react';

const SyntheticScoreTestBanner: React.FC = () => (
  <aside
    role="alert"
    className="relative z-[100] w-full border-y-4 border-ink bg-cardinal px-4 py-3 text-center text-broadcast-white shadow-[0_6px_0_#FFC72C]"
  >
    <p className="text-sm font-black uppercase tracking-[0.18em] sm:text-base">
      SYNTHETIC SCORE TEST
    </p>
    <p className="mt-1 text-sm font-bold">
      Completed-game data is not a live result. Winner and correction emails are disabled.
    </p>
  </aside>
);

export default SyntheticScoreTestBanner;
