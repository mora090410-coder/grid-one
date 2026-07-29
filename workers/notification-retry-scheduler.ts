interface RetrySchedulerEnv {
  CRON_SECRET: string;
  RETRY_ENDPOINT: string;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

interface ScheduledControllerLike {
  cron?: string;
  scheduledTime?: number;
}

const runRetryBatch = async (env: RetrySchedulerEnv) => {
  if (!env.CRON_SECRET || !env.RETRY_ENDPOINT) {
    throw new Error('Notification retry scheduler is not configured.');
  }
  const endpoint = new URL(env.RETRY_ENDPOINT);
  if (endpoint.protocol !== 'https:') {
    throw new Error('Notification retry endpoint must use HTTPS.');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      Accept: 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`Notification retry batch failed with HTTP ${response.status}.`);
  }
};

export default {
  scheduled(
    _controller: ScheduledControllerLike,
    env: RetrySchedulerEnv,
    context: ExecutionContextLike,
  ) {
    context.waitUntil(runRetryBatch(env));
  },
};
