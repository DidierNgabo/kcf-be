import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import { EmailLog } from '../entities/email-log.entity';
import { TriggerRegistryService } from '../registry/trigger-registry.service';
import { TemplateResolverService } from '../rendering/resolver.service';
import { RendererService } from '../rendering/renderer.service';
import { mergeContext } from '../rendering/context-builder';
import { MailtrapProviderAdapter } from '../provider/mailtrap-provider.adapter';
import { MAIL_QUEUE_NAME, MailJobData } from './mail-queue.constants';

@Processor(MAIL_QUEUE_NAME, { concurrency: 5 })
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    @InjectRepository(EmailLog) private readonly logRepo: Repository<EmailLog>,
    private readonly registry: TriggerRegistryService,
    private readonly resolver: TemplateResolverService,
    private readonly renderer: RendererService,
    private readonly provider: MailtrapProviderAdapter,
  ) {
    super();
  }

  async process(job: Job<MailJobData>): Promise<void> {
    const { emailLogId, triggerKey, to, data, locale, templateId } = job.data;
    await this.logRepo.update(emailLogId, {
      attemptCount: job.attemptsMade + 1,
    });

    const trigger = this.registry.getByKey(triggerKey);
    const resolved = templateId
      ? await this.resolver.resolveByTemplateId(templateId)
      : await this.resolver.resolve(triggerKey, locale);
    const context = mergeContext(trigger.dataSchema, data, to);
    const { subject, html, text } = this.renderer.render({
      subjectTemplate: resolved.subjectTemplate,
      bodyTemplate: resolved.bodyTemplate,
      layoutHtml: resolved.layoutHtml,
      context,
    });

    try {
      const providerMessageId = await this.provider.send({
        to,
        subject,
        html,
        text,
        attachments: trigger.staticAttachments,
      });
      await this.logRepo.update(emailLogId, {
        templateId: resolved.templateId,
        versionId: resolved.versionId,
        subjectRendered: subject,
        status: 'sent',
        sentAt: new Date(),
        providerMessageId,
      });
    } catch (err) {
      await this.logRepo.update(emailLogId, {
        templateId: resolved.templateId,
        versionId: resolved.versionId,
        subjectRendered: subject,
        errorMessage:
          err instanceof Error ? err.message : 'Unknown delivery error',
      });
      // Re-throw so BullMQ applies retry/backoff — only the 'failed' event
      // handler below marks the log failed, once retries are exhausted.
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<MailJobData> | undefined): Promise<void> {
    if (!job) return;
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade >= maxAttempts) {
      await this.logRepo.update(job.data.emailLogId, { status: 'failed' });
      this.logger.error(
        `Email send permanently failed after ${job.attemptsMade} attempts (trigger '${job.data.triggerKey}')`,
      );
    }
  }
}
