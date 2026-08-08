import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

const INVALIDATION_CHANNEL = 'mail:cache:invalidate';
const CACHE_TTL_SECONDS = 600;

export interface CachedTemplate {
  templateId: string | null;
  versionId: string | null;
  subjectTemplate: string;
  bodyTemplate: string;
  layoutHtml: string;
}

/**
 * Two-tier cache: an in-process Map (L1, avoids a network round-trip on
 * every send) in front of Redis (L2, shared across instances). Redis alone
 * would already be shared, but the L1 map needs its own invalidation signal
 * when another instance publishes a template — that's what the pub/sub
 * subscriber connection is for. Called only from publish/rollback endpoints,
 * never the send hot path.
 */
@Injectable()
export class TemplateCacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TemplateCacheService.name);
  private readonly local = new Map<string, CachedTemplate>();
  private readonly redis: Redis;
  private readonly subscriber: Redis;

  constructor() {
    const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
    this.redis = new Redis(url);
    this.subscriber = new Redis(url);
  }

  async onModuleInit(): Promise<void> {
    await this.subscriber.subscribe(INVALIDATION_CHANNEL);
    this.subscriber.on('message', (_channel, triggerKey: string) => {
      this.dropLocal(triggerKey);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.subscriber.quit().catch(() => undefined);
    await this.redis.quit().catch(() => undefined);
  }

  private cacheKey(triggerKey: string, locale: string): string {
    return `mail:tpl:${triggerKey}:${locale}`;
  }

  private dropLocal(triggerKey: string): void {
    const prefix = `mail:tpl:${triggerKey}:`;
    for (const key of this.local.keys()) {
      if (key.startsWith(prefix)) this.local.delete(key);
    }
  }

  async get(
    triggerKey: string,
    locale: string,
  ): Promise<CachedTemplate | null> {
    const key = this.cacheKey(triggerKey, locale);
    const localHit = this.local.get(key);
    if (localHit) return localHit;

    try {
      const raw = await this.redis.get(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedTemplate;
      this.local.set(key, parsed);
      return parsed;
    } catch (err) {
      this.logger.warn(`Template cache read failed: ${(err as Error).message}`);
      return null;
    }
  }

  async set(
    triggerKey: string,
    locale: string,
    value: CachedTemplate,
  ): Promise<void> {
    const key = this.cacheKey(triggerKey, locale);
    this.local.set(key, value);
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS);
    } catch (err) {
      this.logger.warn(
        `Template cache write failed: ${(err as Error).message}`,
      );
    }
  }

  async invalidate(triggerKey: string): Promise<void> {
    this.dropLocal(triggerKey);
    try {
      const keys = await this.redis.keys(`mail:tpl:${triggerKey}:*`);
      if (keys.length > 0) await this.redis.del(...keys);
      await this.redis.publish(INVALIDATION_CHANNEL, triggerKey);
    } catch (err) {
      this.logger.warn(
        `Template cache invalidation failed: ${(err as Error).message}`,
      );
    }
  }
}
