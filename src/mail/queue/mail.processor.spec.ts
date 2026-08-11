import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { MailProcessor } from './mail.processor';
import { MailJobData } from './mail-queue.constants';
import { EmailLog } from '../entities/email-log.entity';
import { TriggerRegistryService } from '../registry/trigger-registry.service';
import { TemplateResolverService } from '../rendering/resolver.service';
import { MailtrapProviderAdapter } from '../provider/mailtrap-provider.adapter';
import { SHARED_EMAIL_ATTACHMENTS } from '../triggers/shared-layout';

describe('MailProcessor', () => {
  let logRepo: { update: jest.Mock };
  let registry: { getByKey: jest.Mock };
  let resolver: { resolve: jest.Mock; resolveByTemplateId: jest.Mock };
  let renderer: { render: jest.Mock };
  let provider: { send: jest.Mock };
  let processor: MailProcessor;

  const jobData: MailJobData = {
    emailLogId: 'log-1',
    triggerKey: 'user.password-reset',
    to: 'user@example.org',
    data: { name: 'Aline', resetUrl: 'https://x/reset' },
    locale: 'default',
  };

  beforeEach(() => {
    logRepo = { update: jest.fn().mockResolvedValue(undefined) };
    registry = {
      getByKey: jest.fn().mockReturnValue({
        key: jobData.triggerKey,
        dataSchema: [],
        staticAttachments: undefined,
        defaults: { subject: 'Reset', bodyHtml: '<p>reset</p>' },
      }),
    };
    resolver = {
      resolve: jest.fn().mockResolvedValue({
        templateId: 't1',
        versionId: 'v1',
        subjectTemplate: 'Reset',
        bodyTemplate: '<p>reset</p>',
        layoutHtml: '{{{body}}}',
      }),
      resolveByTemplateId: jest.fn(),
    };
    renderer = {
      render: jest.fn().mockReturnValue({
        subject: 'Reset',
        html: '<p>reset</p>',
        text: 'reset',
      }),
    };
    provider = { send: jest.fn().mockResolvedValue('provider-msg-id') };

    processor = new MailProcessor(
      logRepo as unknown as Repository<EmailLog>,
      registry as unknown as TriggerRegistryService,
      resolver as unknown as TemplateResolverService,
      renderer,
      provider as unknown as MailtrapProviderAdapter,
    );
  });

  function makeJob(
    overrides: Partial<Job<MailJobData>> = {},
  ): Job<MailJobData> {
    return {
      data: jobData,
      attemptsMade: 0,
      opts: { attempts: 5 },
      ...overrides,
    } as Job<MailJobData>;
  }

  it('renders and delivers successfully, marking the log sent with the provider message id', async () => {
    await processor.process(makeJob());

    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: jobData.to,
        subject: 'Reset',
        html: '<p>reset</p>',
      }),
    );
    expect(logRepo.update).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({
        status: 'sent',
        providerMessageId: 'provider-msg-id',
      }),
    );
  });

  it('bypasses the DB-backed template resolver and renders the code default wrapped in the shared layout, attaching the shared logo', async () => {
    await processor.process(makeJob());

    expect(resolver.resolve).not.toHaveBeenCalled();
    expect(resolver.resolveByTemplateId).not.toHaveBeenCalled();
    expect(renderer.render).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectTemplate: 'Reset',
        bodyTemplate: '<p>reset</p>',
        layoutHtml: expect.stringContaining('{{{body}}}') as string,
      }),
    );
    expect(provider.send).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: SHARED_EMAIL_ATTACHMENTS }),
    );
  });

  it('still uses resolveByTemplateId for explicit template-id sends (admin test-send/broadcast)', async () => {
    resolver.resolveByTemplateId.mockResolvedValue({
      templateId: 't1',
      versionId: 'v1',
      subjectTemplate: 'Reset',
      bodyTemplate: '<p>reset</p>',
      layoutHtml: '{{{body}}}',
    });

    await processor.process(
      makeJob({ data: { ...jobData, templateId: 'explicit-id' } }),
    );

    expect(resolver.resolveByTemplateId).toHaveBeenCalledWith('explicit-id');
    expect(resolver.resolve).not.toHaveBeenCalled();
  });

  it('records the error and re-throws when delivery fails, without marking the log failed yet', async () => {
    provider.send.mockRejectedValue(new Error('mailtrap down'));

    await expect(processor.process(makeJob())).rejects.toThrow('mailtrap down');

    expect(logRepo.update).toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({ errorMessage: 'mailtrap down' }),
    );
    expect(logRepo.update).not.toHaveBeenCalledWith(
      'log-1',
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('only marks the log failed once retries are exhausted', async () => {
    await processor.onFailed(
      makeJob({ attemptsMade: 3, opts: { attempts: 5 } }),
    );
    expect(logRepo.update).not.toHaveBeenCalledWith('log-1', {
      status: 'failed',
    });

    await processor.onFailed(
      makeJob({ attemptsMade: 5, opts: { attempts: 5 } }),
    );
    expect(logRepo.update).toHaveBeenCalledWith('log-1', { status: 'failed' });
  });
});
