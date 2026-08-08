import { DiscoveryService } from '@nestjs/core';
import { TriggerRegistryService } from './trigger-registry.service';
import { MailTrigger } from './mail-trigger.decorator';

const baseMeta = {
  description: 'desc',
  dataSchema: [],
  defaults: { subject: 'Subject', bodyHtml: '<p>body</p>' },
};

@MailTrigger({ key: 'trigger.one', name: 'One', ...baseMeta })
class TriggerOne {}

@MailTrigger({ key: 'trigger.two', name: 'Two', ...baseMeta })
class TriggerTwo {}

@MailTrigger({ key: 'trigger.one', name: 'Duplicate', ...baseMeta })
class DuplicateTriggerOne {}

class NotATrigger {}

type Metatype = new (...args: never[]) => unknown;

function makeDiscovery(metatypes: (Metatype | undefined)[]): DiscoveryService {
  return {
    getProviders: () => metatypes.map((metatype) => ({ metatype })),
  } as unknown as DiscoveryService;
}

describe('TriggerRegistryService', () => {
  it('collects every @MailTrigger-decorated provider into the registry', () => {
    const service = new TriggerRegistryService(
      makeDiscovery([TriggerOne, TriggerTwo, NotATrigger, undefined]),
    );
    service.onModuleInit();

    expect(service.getAll()).toHaveLength(2);
    expect(service.has('trigger.one')).toBe(true);
    expect(service.getByKey('trigger.two').name).toBe('Two');
  });

  it('throws at boot on a duplicate trigger key', () => {
    const service = new TriggerRegistryService(
      makeDiscovery([TriggerOne, DuplicateTriggerOne]),
    );
    expect(() => service.onModuleInit()).toThrow(
      /Duplicate mail trigger key: trigger.one/,
    );
  });

  it('throws a descriptive error for an unknown key', () => {
    const service = new TriggerRegistryService(makeDiscovery([TriggerOne]));
    service.onModuleInit();
    expect(() => service.getByKey('nope')).toThrow(/Unknown mail trigger/);
  });
});
