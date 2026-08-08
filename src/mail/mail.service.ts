import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { EmailLog } from './entities/email-log.entity';
import { TriggerRegistryService } from './registry/trigger-registry.service';
import { redactSensitiveFields } from './rendering/context-builder';
import { MAIL_QUEUE_NAME, MailJobData } from './queue/mail-queue.constants';

export interface SendMailInput {
  triggerKey: string;
  to: string;
  data: Record<string, unknown>;
  locale?: string;
  isTest?: boolean;
  // See MailJobData.templateId — only set for broadcast sends.
  templateId?: string;
}

const DEFAULT_LOCALE = 'default';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @InjectRepository(EmailLog) private readonly logRepo: Repository<EmailLog>,
    @InjectQueue(MAIL_QUEUE_NAME) private readonly queue: Queue<MailJobData>,
    private readonly registry: TriggerRegistryService,
  ) {}

  /**
   * Validates the trigger exists (a programmer error if not — thrown
   * immediately) then enqueues the send and returns. Never throws for
   * template/render/delivery problems — those are handled entirely inside
   * the queue processor and reflected on the email_log row instead. If
   * enqueueing itself fails (e.g. Redis unreachable), the log is marked
   * failed and the error is re-thrown so callers that care (like a
   * follow-up cron loop deciding whether to mark a record "sent") can react.
   */
  async send(input: SendMailInput): Promise<void> {
    const trigger = this.registry.getByKey(input.triggerKey);
    const locale = input.locale ?? DEFAULT_LOCALE;
    const redactedPayload = redactSensitiveFields(
      trigger.dataSchema,
      input.data,
    );

    const log = await this.logRepo.save(
      this.logRepo.create({
        triggerKey: input.triggerKey,
        templateId: input.templateId,
        locale,
        recipientEmail: input.to,
        payload: redactedPayload,
        status: 'queued',
        isTest: input.isTest ?? false,
      }),
    );

    try {
      await this.queue.add(
        'send',
        {
          emailLogId: log.id,
          triggerKey: input.triggerKey,
          templateId: input.templateId,
          to: input.to,
          data: input.data,
          locale,
        },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      );
    } catch (err) {
      this.logger.error(
        `Failed to enqueue email for trigger '${input.triggerKey}'`,
        err,
      );
      await this.logRepo
        .update(log.id, {
          status: 'failed',
          errorMessage:
            err instanceof Error ? err.message : 'Failed to enqueue',
        })
        .catch(() => undefined);
      throw err;
    }
  }
}
