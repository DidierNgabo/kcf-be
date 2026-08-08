import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateResolverService } from './resolver.service';
import { TemplateCacheService } from './template-cache.service';
import { TriggerRegistryService } from '../registry/trigger-registry.service';
import { EmailTemplate } from '../entities/email-template.entity';
import { EmailTemplateVersion } from '../entities/email-template-version.entity';
import { EmailLayout } from '../entities/email-layout.entity';

describe('TemplateResolverService', () => {
  let service: TemplateResolverService;
  let templateRepo: { findOne: jest.Mock };
  let versionRepo: { findOne: jest.Mock };
  let layoutRepo: { findOne: jest.Mock };
  let cache: { get: jest.Mock; set: jest.Mock };
  let registry: { getByKey: jest.Mock };

  const triggerDefaults = {
    key: 'user.password-reset',
    name: 'Password reset',
    description: '',
    dataSchema: [],
    defaults: { subject: 'Reset', bodyHtml: '<p>reset default</p>' },
  };

  beforeEach(async () => {
    templateRepo = { findOne: jest.fn() };
    versionRepo = { findOne: jest.fn() };
    layoutRepo = { findOne: jest.fn() };
    cache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };
    registry = { getByKey: jest.fn().mockReturnValue(triggerDefaults) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateResolverService,
        { provide: getRepositoryToken(EmailTemplate), useValue: templateRepo },
        {
          provide: getRepositoryToken(EmailTemplateVersion),
          useValue: versionRepo,
        },
        { provide: getRepositoryToken(EmailLayout), useValue: layoutRepo },
        { provide: TemplateCacheService, useValue: cache },
        { provide: TriggerRegistryService, useValue: registry },
      ],
    }).compile();

    service = module.get(TemplateResolverService);
  });

  it('returns the cached result without touching the database', async () => {
    cache.get.mockResolvedValue({
      templateId: 't1',
      versionId: 'v1',
      subjectTemplate: 'cached subject',
      bodyTemplate: 'cached body',
      layoutHtml: '{{{body}}}',
    });

    const result = await service.resolve('user.password-reset', 'default');

    expect(result.subjectTemplate).toBe('cached subject');
    expect(templateRepo.findOne).not.toHaveBeenCalled();
  });

  it('resolves a published template at the requested locale', async () => {
    templateRepo.findOne.mockResolvedValue({ id: 't1', layoutId: null });
    versionRepo.findOne.mockResolvedValue({
      id: 'v1',
      subject: 'DB subject',
      bodyHtml: 'DB body',
    });
    layoutRepo.findOne.mockResolvedValue({
      bodyHtml: '<html>{{{body}}}</html>',
    });

    const result = await service.resolve('user.password-reset', 'fr');

    expect(result.templateId).toBe('t1');
    expect(result.subjectTemplate).toBe('DB subject');
    expect(result.fromCodeDefault).toBe(false);
    expect(cache.set).toHaveBeenCalled();
  });

  it('falls back to the default locale when the requested locale has no template', async () => {
    templateRepo.findOne
      .mockResolvedValueOnce(null) // fr
      .mockResolvedValueOnce({ id: 't1', layoutId: null }); // default
    versionRepo.findOne.mockResolvedValue({
      id: 'v1',
      subject: 'default-locale subject',
      bodyHtml: 'body',
    });
    layoutRepo.findOne.mockResolvedValue(null);

    const result = await service.resolve('user.password-reset', 'fr');

    expect(result.subjectTemplate).toBe('default-locale subject');
    expect(templateRepo.findOne).toHaveBeenCalledTimes(2);
  });

  it('falls back to the code-shipped default when nothing exists in the database', async () => {
    templateRepo.findOne.mockResolvedValue(null);

    const result = await service.resolve('user.password-reset', 'default');

    expect(result.fromCodeDefault).toBe(true);
    expect(result.templateId).toBeNull();
    expect(result.subjectTemplate).toBe(triggerDefaults.defaults.subject);
    expect(result.bodyTemplate).toBe(triggerDefaults.defaults.bodyHtml);
  });

  it('never throws — a database error still resolves via the code default', async () => {
    templateRepo.findOne.mockRejectedValue(new Error('connection lost'));

    const result = await service.resolve('user.password-reset', 'default');

    expect(result.fromCodeDefault).toBe(true);
    expect(result.bodyTemplate).toBe(triggerDefaults.defaults.bodyHtml);
  });

  describe('resolveByTemplateId', () => {
    it('loads the exact template requested, bypassing the triggerKey fallback chain', async () => {
      templateRepo.findOne.mockResolvedValue({
        id: 't1',
        layoutId: 'layout-1',
      });
      versionRepo.findOne.mockResolvedValue({
        id: 'v1',
        subject: 'Broadcast subject',
        bodyHtml: 'Broadcast body',
      });
      layoutRepo.findOne.mockResolvedValue({ bodyHtml: '{{{body}}}<footer/>' });

      const result = await service.resolveByTemplateId('t1');

      expect(result.subjectTemplate).toBe('Broadcast subject');
      expect(result.fromCodeDefault).toBe(false);
      expect(layoutRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'layout-1' },
      });
    });

    it('throws when the template does not exist', async () => {
      templateRepo.findOne.mockResolvedValue(null);

      await expect(service.resolveByTemplateId('missing')).rejects.toThrow(
        /not found/,
      );
    });

    it('throws when the template has no published version', async () => {
      templateRepo.findOne.mockResolvedValue({ id: 't1', layoutId: null });
      versionRepo.findOne.mockResolvedValue(null);

      await expect(service.resolveByTemplateId('t1')).rejects.toThrow(
        /no published version/,
      );
    });
  });
});
