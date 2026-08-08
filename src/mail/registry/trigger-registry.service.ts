import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { MAIL_TRIGGER_METADATA } from './mail-trigger.decorator';
import { TriggerMetadata } from './mail-trigger.types';

@Injectable()
export class TriggerRegistryService implements OnModuleInit {
  private readonly logger = new Logger(TriggerRegistryService.name);
  private readonly triggers = new Map<string, TriggerMetadata>();

  constructor(private readonly discovery: DiscoveryService) {}

  onModuleInit(): void {
    const providers = this.discovery.getProviders();
    for (const wrapper of providers) {
      const metatype = wrapper.metatype;
      if (!metatype) continue;
      const metadata = Reflect.getMetadata(MAIL_TRIGGER_METADATA, metatype) as
        | TriggerMetadata
        | undefined;
      if (!metadata) continue;

      if (this.triggers.has(metadata.key)) {
        throw new Error(`Duplicate mail trigger key: ${metadata.key}`);
      }
      this.triggers.set(metadata.key, metadata);
    }
    this.logger.log(`Registered ${this.triggers.size} mail triggers`);
  }

  getAll(): TriggerMetadata[] {
    return [...this.triggers.values()];
  }

  getByKey(key: string): TriggerMetadata {
    const trigger = this.triggers.get(key);
    if (!trigger) {
      throw new Error(`Unknown mail trigger: ${key}`);
    }
    return trigger;
  }

  has(key: string): boolean {
    return this.triggers.has(key);
  }
}
