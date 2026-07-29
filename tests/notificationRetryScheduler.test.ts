import { beforeEach, describe, expect, it, vi } from 'vitest';
import scheduler from '../workers/notification-retry-scheduler';

const controller = {};

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe('notification retry cron scheduler', () => {
  it('runs the protected retry endpoint once per scheduled event', async () => {
    const provider = vi.fn(async () => Response.json({ claimed: 0 }));
    vi.stubGlobal('fetch', provider);
    let scheduled: Promise<unknown> | undefined;

    scheduler.scheduled(controller, {
      CRON_SECRET: 'cron-secret',
      RETRY_ENDPOINT: 'https://example.test/api/notifications/retry',
    }, {
      waitUntil: promise => {
        scheduled = promise;
      },
    });
    await scheduled;

    expect(provider).toHaveBeenCalledTimes(1);
    expect(provider).toHaveBeenCalledWith(
      new URL('https://example.test/api/notifications/retry'),
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer cron-secret',
          Accept: 'application/json',
        },
      },
    );
  });

  it('fails observably on endpoint errors instead of swallowing a missed batch', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('failure', { status: 503 })));
    let scheduled: Promise<unknown> | undefined;

    scheduler.scheduled(controller, {
      CRON_SECRET: 'cron-secret',
      RETRY_ENDPOINT: 'https://example.test/api/notifications/retry',
    }, {
      waitUntil: promise => {
        scheduled = promise;
      },
    });

    await expect(scheduled).rejects.toThrow('HTTP 503');
  });

  it('refuses an insecure retry endpoint', async () => {
    let scheduled: Promise<unknown> | undefined;

    scheduler.scheduled(controller, {
      CRON_SECRET: 'cron-secret',
      RETRY_ENDPOINT: 'http://example.test/api/notifications/retry',
    }, {
      waitUntil: promise => {
        scheduled = promise;
      },
    });

    await expect(scheduled).rejects.toThrow('must use HTTPS');
  });
});
