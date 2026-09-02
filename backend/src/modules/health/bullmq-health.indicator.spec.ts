import { HealthIndicatorService } from '@nestjs/terminus';
import { Queue } from 'bullmq';
import { BullmqHealthIndicator } from './bullmq-health.indicator';

describe('BullmqHealthIndicator', () => {
  const build = () => {
    const healthIndicatorService = {
      check: jest.fn((key: string) => ({
        up: jest.fn(() => ({ [key]: { status: 'up' } })),
        down: jest.fn((details: Record<string, string>) => ({
          [key]: { status: 'down', ...details },
        })),
      })),
    };
    const notificationsQueue = {
      client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }),
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0 }),
    };
    const safetyQueue = {
      getJobCounts: jest.fn().mockResolvedValue({ waiting: 0 }),
    };
    const indicator = new BullmqHealthIndicator(
      healthIndicatorService as unknown as HealthIndicatorService,
      notificationsQueue as unknown as Queue,
      safetyQueue as unknown as Queue,
    );

    return { indicator, notificationsQueue, safetyQueue };
  };

  it('reports Redis as up after a successful ping', async () => {
    const { indicator, notificationsQueue } = build();

    await expect(indicator.redisCheck('redis')).resolves.toEqual({
      redis: { status: 'up' },
    });
    await expect(notificationsQueue.client).resolves.toMatchObject({
      ping: expect.any(Function),
    });
  });

  it('reports Redis as down without exposing the connection error', async () => {
    const { indicator, notificationsQueue } = build();
    notificationsQueue.client = Promise.reject(
      new Error('connect ECONNREFUSED 10.0.0.9:6379'),
    );

    await expect(indicator.redisCheck('redis')).resolves.toEqual({
      redis: { status: 'down', message: 'Unable to reach Redis' },
    });
  });

  it('checks both required BullMQ queues', async () => {
    const { indicator, notificationsQueue, safetyQueue } = build();

    await expect(indicator.bullmqCheck('bullmq')).resolves.toEqual({
      bullmq: { status: 'up' },
    });
    expect(notificationsQueue.getJobCounts).toHaveBeenCalledWith(
      'waiting',
      'active',
      'delayed',
    );
    expect(safetyQueue.getJobCounts).toHaveBeenCalledWith(
      'waiting',
      'active',
      'delayed',
    );
  });

  it('reports BullMQ as down when either queue is unavailable', async () => {
    const { indicator, safetyQueue } = build();
    safetyQueue.getJobCounts.mockRejectedValueOnce(
      new Error('connection lost'),
    );

    await expect(indicator.bullmqCheck('bullmq')).resolves.toEqual({
      bullmq: { status: 'down', message: 'Unable to reach BullMQ queues' },
    });
  });
});
