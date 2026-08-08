import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';

// BullMQ requires maxRetriesPerRequest: null on connections it manages.
// family: 0 enables dual-stack DNS resolution, which some hosts (e.g.
// Railway's internal Redis networking) need to avoid connections hanging.
function createConnection(): Redis {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, { maxRetriesPerRequest: null, family: 0 });
}

// BullModule.forRoot() needs a connection at static module-definition time,
// before Nest's DI container exists — so this is created once as a
// module-level singleton rather than through injection.
export const mailRedisConnection = createConnection();

// BullMQ deliberately does not close a connection it didn't create itself
// (so it can be shared across queues/workers) — closing the Queue/Worker
// wrapper alone leaves this socket open, which keeps the process alive after
// app.close(). This provider owns closing it during shutdown.
@Injectable()
export class MailRedisLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(MailRedisLifecycle.name);

  async onApplicationShutdown(): Promise<void> {
    await mailRedisConnection.quit().catch((err: Error) => {
      this.logger.warn(
        `Failed to close shared BullMQ Redis connection: ${err.message}`,
      );
    });
  }
}
