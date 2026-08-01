interface ScoreSchedulerEnv {
  CRON_SECRET: string;
  REFRESH_ENDPOINT: string;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

interface ScheduledControllerLike {
  cron?: string;
  scheduledTime?: number;
}

const runScoreRefresh = async (env: ScoreSchedulerEnv) => {
  if (!env.CRON_SECRET || !env.REFRESH_ENDPOINT) {
    throw new Error('Score refresh scheduler is not configured.');
  }
  const endpoint = new URL(env.REFRESH_ENDPOINT);
  if (endpoint.protocol !== 'https:') {
    throw new Error('Score refresh endpoint must use HTTPS.');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Score refresh tick failed with HTTP ${response.status}.`);
  }
};

export default {
  scheduled(
    _controller: ScheduledControllerLike,
    env: ScoreSchedulerEnv,
    context: ExecutionContextLike,
  ) {
    context.waitUntil(runScoreRefresh(env));
  },
};
