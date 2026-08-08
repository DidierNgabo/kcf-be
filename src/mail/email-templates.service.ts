import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailTemplateVersion } from './entities/email-template-version.entity';
import { EmailLayout } from './entities/email-layout.entity';
import { EmailLog } from './entities/email-log.entity';
import { TriggerRegistryService } from './registry/trigger-registry.service';
import { TemplateCacheService } from './rendering/template-cache.service';
import { RendererService } from './rendering/renderer.service';
import { validateTemplateSource } from './rendering/validator';
import {
  buildSampleContext,
  mergePreviewContext,
} from './rendering/context-builder';
import { MailtrapProviderAdapter } from './provider/mailtrap-provider.adapter';
import { TemplateValidationException } from './exceptions/template-validation.exception';
import { AuditService } from '../audit/audit.service';
import { CreateEmailTemplateDto } from './dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto';
import { SaveTemplateVersionDto } from './dto/save-template-version.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { TestSendDto } from './dto/test-send.dto';
import { BroadcastSendDto } from './dto/broadcast-send.dto';
import { BROADCAST_TRIGGER_KEY } from './mail.constants';
import { MailService } from './mail.service';
import { Sponsor } from '../sponsor/entities/sponsor.entity';
import {
  resolveAudienceSponsors,
  buildUnsubscribeUrl,
} from './broadcast/broadcast-audience.util';

const DEFAULT_CHANNEL = 'email';
const PASSTHROUGH_LAYOUT_HTML = '{{{body}}}';
const PREVIEW_RECIPIENT = 'preview@example.org';

@Injectable()
export class EmailTemplatesService {
  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    @InjectRepository(EmailTemplateVersion)
    private readonly versionRepo: Repository<EmailTemplateVersion>,
    @InjectRepository(EmailLayout)
    private readonly layoutRepo: Repository<EmailLayout>,
    @InjectRepository(EmailLog) private readonly logRepo: Repository<EmailLog>,
    @InjectRepository(Sponsor)
    private readonly sponsorRepo: Repository<Sponsor>,
    private readonly registry: TriggerRegistryService,
    private readonly cache: TemplateCacheService,
    private readonly renderer: RendererService,
    private readonly provider: MailtrapProviderAdapter,
    private readonly audit: AuditService,
    private readonly mailService: MailService,
  ) {}

  async list() {
    const templates = await this.templateRepo.find({
      order: { createdAt: 'DESC' },
    });
    const results: Array<
      EmailTemplate & {
        triggerName: string;
        hasDraftChanges: boolean;
        hasPublished: boolean;
        lastUpdatedAt: Date;
      }
    > = [];
    for (const template of templates) {
      const [draft, published] = await Promise.all([
        this.versionRepo.findOne({
          where: { templateId: template.id, status: 'draft' },
        }),
        this.versionRepo.findOne({
          where: { templateId: template.id, status: 'published' },
        }),
      ]);
      const trigger = this.registry.has(template.triggerKey)
        ? this.registry.getByKey(template.triggerKey)
        : null;
      results.push({
        ...template,
        triggerName:
          template.kind === 'broadcast'
            ? (template.name ?? trigger?.name ?? template.triggerKey)
            : (trigger?.name ?? template.triggerKey),
        hasDraftChanges: !!draft,
        hasPublished: !!published,
        lastUpdatedAt:
          draft?.createdAt ?? published?.publishedAt ?? template.updatedAt,
      });
    }
    return results;
  }

  async listTriggers() {
    const templates = await this.templateRepo.find();
    const templatedKeys = new Set(templates.map((t) => t.triggerKey));
    return this.registry.getAll().map((trigger) => ({
      ...trigger,
      hasTemplate: templatedKeys.has(trigger.key),
    }));
  }

  getTrigger(key: string) {
    try {
      return this.registry.getByKey(key);
    } catch {
      throw new NotFoundException(`Unknown mail trigger: ${key}`);
    }
  }

  async listLayouts() {
    return this.layoutRepo.find({ order: { name: 'ASC' } });
  }

  async getLayout(id: string) {
    const layout = await this.layoutRepo.findOne({ where: { id } });
    if (!layout) throw new NotFoundException(`Layout ${id} not found`);
    return layout;
  }

  async getOne(id: string) {
    const template = await this.findTemplateOrThrow(id);
    const versions = await this.versionRepo.find({
      where: { templateId: id },
      order: { createdAt: 'DESC' },
    });
    return { ...template, versions };
  }

  async create(dto: CreateEmailTemplateDto, actorUserId: string | null) {
    const locale = dto.locale ?? 'default';
    if (dto.kind === 'broadcast') {
      return this.createBroadcast(dto.name!, locale, actorUserId);
    }

    if (!dto.triggerKey) {
      throw new BadRequestException('triggerKey is required');
    }
    const trigger = this.getTrigger(dto.triggerKey);

    const existing = await this.templateRepo.findOne({
      where: { triggerKey: trigger.key, locale, channel: DEFAULT_CHANNEL },
    });
    if (existing) {
      throw new ConflictException(
        `A template for '${trigger.key}' / '${locale}' already exists`,
      );
    }

    const template = await this.templateRepo.save(
      this.templateRepo.create({
        triggerKey: trigger.key,
        kind: 'trigger',
        locale,
        channel: DEFAULT_CHANNEL,
      }),
    );

    const draft = await this.versionRepo.save(
      this.versionRepo.create({
        templateId: template.id,
        status: 'draft',
        subject: trigger.defaults.subject,
        bodyHtml: trigger.defaults.bodyHtml,
        sampleData: buildSampleContext(trigger.dataSchema),
        createdByUserId: actorUserId,
      }),
    );

    await this.audit.record(
      'email_template.created',
      'email_template',
      template.id,
      actorUserId ?? undefined,
      {
        triggerKey: trigger.key,
        locale,
      },
    );

    return { ...template, versions: [draft] };
  }

  // Broadcasts share one reserved triggerKey but, unlike coded triggers,
  // many campaigns can coexist — so there's no existing-template uniqueness
  // check here, and the 'broadcast' layout (unsubscribe footer) is assigned
  // automatically so staff never have to think about it.
  private async createBroadcast(
    name: string,
    locale: string,
    actorUserId: string | null,
  ) {
    const trigger = this.getTrigger(BROADCAST_TRIGGER_KEY);
    const broadcastLayout = await this.layoutRepo.findOne({
      where: { key: 'broadcast' },
    });

    const template = await this.templateRepo.save(
      this.templateRepo.create({
        triggerKey: BROADCAST_TRIGGER_KEY,
        kind: 'broadcast',
        name,
        locale,
        channel: DEFAULT_CHANNEL,
        layoutId: broadcastLayout?.id ?? null,
      }),
    );

    const draft = await this.versionRepo.save(
      this.versionRepo.create({
        templateId: template.id,
        status: 'draft',
        subject: trigger.defaults.subject,
        bodyHtml: trigger.defaults.bodyHtml,
        sampleData: buildSampleContext(trigger.dataSchema),
        createdByUserId: actorUserId,
      }),
    );

    await this.audit.record(
      'email_template.created',
      'email_template',
      template.id,
      actorUserId ?? undefined,
      { kind: 'broadcast', name },
    );

    return { ...template, versions: [draft] };
  }

  async updateMetadata(
    id: string,
    dto: UpdateEmailTemplateDto,
    actorUserId: string | null,
  ) {
    const template = await this.findTemplateOrThrow(id);
    if (dto.layoutId !== undefined) {
      if (dto.layoutId) await this.getLayout(dto.layoutId);
      template.layoutId = dto.layoutId;
    }
    const saved = await this.templateRepo.save(template);
    await this.audit.record(
      'email_template.updated',
      'email_template',
      id,
      actorUserId ?? undefined,
      {
        layoutId: dto.layoutId,
      },
    );
    await this.cache.invalidate(template.triggerKey);
    return saved;
  }

  async listVersions(templateId: string) {
    await this.findTemplateOrThrow(templateId);
    return this.versionRepo.find({
      where: { templateId },
      order: { createdAt: 'DESC' },
    });
  }

  async getVersion(templateId: string, versionId: string) {
    const version = await this.versionRepo.findOne({
      where: { id: versionId, templateId },
    });
    if (!version) throw new NotFoundException(`Version ${versionId} not found`);
    return version;
  }

  async saveDraft(
    templateId: string,
    dto: SaveTemplateVersionDto,
    actorUserId: string | null,
  ) {
    const template = await this.findTemplateOrThrow(templateId);
    const trigger = this.getTrigger(template.triggerKey);

    const validation = validateTemplateSource(
      dto.subject,
      dto.bodyHtml,
      trigger.dataSchema,
    );
    if (!validation.valid) {
      throw new TemplateValidationException(
        validation.errors,
        validation.warnings,
      );
    }

    let draft = await this.versionRepo.findOne({
      where: { templateId, status: 'draft' },
    });
    if (draft) {
      draft.subject = dto.subject;
      draft.bodyHtml = dto.bodyHtml;
      draft.sampleData = dto.sampleData ?? draft.sampleData;
      draft.createdByUserId = actorUserId;
    } else {
      draft = this.versionRepo.create({
        templateId,
        status: 'draft',
        subject: dto.subject,
        bodyHtml: dto.bodyHtml,
        sampleData: dto.sampleData ?? buildSampleContext(trigger.dataSchema),
        createdByUserId: actorUserId,
      });
    }
    const saved = await this.versionRepo.save(draft);
    await this.audit.record(
      'email_template.draft_saved',
      'email_template',
      templateId,
      actorUserId ?? undefined,
      {
        versionId: saved.id,
      },
    );
    return { ...saved, warnings: validation.warnings };
  }

  async publish(
    templateId: string,
    versionId: string,
    actorUserId: string | null,
  ) {
    const template = await this.findTemplateOrThrow(templateId);
    const draft = await this.getVersion(templateId, versionId);
    if (draft.status !== 'draft') {
      throw new ConflictException(
        'Only the current draft version can be published',
      );
    }

    const currentPublished = await this.versionRepo.findOne({
      where: { templateId, status: 'published' },
    });
    if (currentPublished) {
      currentPublished.status = 'archived';
      await this.versionRepo.save(currentPublished);
    }

    const nextVersionNumber = await this.nextVersionNumber(templateId);
    draft.status = 'published';
    draft.versionNumber = nextVersionNumber;
    draft.publishedAt = new Date();
    const published = await this.versionRepo.save(draft);

    await this.audit.record(
      'email_template.published',
      'email_template',
      templateId,
      actorUserId ?? undefined,
      {
        versionId: published.id,
        versionNumber: nextVersionNumber,
      },
    );
    await this.cache.invalidate(template.triggerKey);
    return published;
  }

  async rollback(
    templateId: string,
    versionId: string,
    actorUserId: string | null,
  ) {
    const template = await this.findTemplateOrThrow(templateId);
    const target = await this.getVersion(templateId, versionId);

    const currentPublished = await this.versionRepo.findOne({
      where: { templateId, status: 'published' },
    });
    if (currentPublished) {
      currentPublished.status = 'archived';
      await this.versionRepo.save(currentPublished);
    }

    const nextVersionNumber = await this.nextVersionNumber(templateId);
    const restored = await this.versionRepo.save(
      this.versionRepo.create({
        templateId,
        status: 'published',
        subject: target.subject,
        bodyHtml: target.bodyHtml,
        sampleData: target.sampleData,
        versionNumber: nextVersionNumber,
        publishedAt: new Date(),
        createdByUserId: actorUserId,
      }),
    );

    await this.audit.record(
      'email_template.rolled_back',
      'email_template',
      templateId,
      actorUserId ?? undefined,
      {
        fromVersionId: target.id,
        newVersionId: restored.id,
        versionNumber: nextVersionNumber,
      },
    );
    await this.cache.invalidate(template.triggerKey);
    return restored;
  }

  async preview(templateId: string, dto: PreviewTemplateDto) {
    const template = await this.findTemplateOrThrow(templateId);
    const trigger = this.getTrigger(template.triggerKey);

    const validation = validateTemplateSource(
      dto.subject,
      dto.bodyHtml,
      trigger.dataSchema,
    );
    if (!validation.valid) {
      return {
        valid: false,
        errors: validation.errors,
        warnings: validation.warnings,
      };
    }

    const layoutHtml = await this.resolveLayoutHtml(template.layoutId);
    const context = mergePreviewContext(
      trigger.dataSchema,
      dto.sampleData,
      PREVIEW_RECIPIENT,
    );
    const rendered = this.renderer.render({
      subjectTemplate: dto.subject,
      bodyTemplate: dto.bodyHtml,
      layoutHtml,
      context,
    });

    return {
      valid: true,
      errors: [],
      warnings: validation.warnings,
      ...rendered,
    };
  }

  async testSend(
    templateId: string,
    dto: TestSendDto,
    actorUserId: string | null,
  ) {
    const template = await this.findTemplateOrThrow(templateId);
    const trigger = this.getTrigger(template.triggerKey);

    const version = dto.versionId
      ? await this.getVersion(templateId, dto.versionId)
      : ((await this.versionRepo.findOne({
          where: { templateId, status: 'draft' },
        })) ??
        (await this.versionRepo.findOne({
          where: { templateId, status: 'published' },
        })));
    if (!version)
      throw new NotFoundException('No draft or published version to send');

    const validation = validateTemplateSource(
      version.subject,
      version.bodyHtml,
      trigger.dataSchema,
    );
    if (!validation.valid) {
      throw new TemplateValidationException(
        validation.errors,
        validation.warnings,
      );
    }

    const layoutHtml = await this.resolveLayoutHtml(template.layoutId);
    const context = mergePreviewContext(
      trigger.dataSchema,
      dto.sampleData ?? version.sampleData,
      dto.to,
    );
    const rendered = this.renderer.render({
      subjectTemplate: version.subject,
      bodyTemplate: version.bodyHtml,
      layoutHtml,
      context,
    });
    const subject = `[TEST] ${rendered.subject}`;

    const log = await this.logRepo.save(
      this.logRepo.create({
        triggerKey: template.triggerKey,
        templateId: template.id,
        versionId: version.id,
        locale: template.locale,
        recipientEmail: dto.to,
        subjectRendered: subject,
        status: 'queued',
        isTest: true,
      }),
    );

    try {
      const providerMessageId = await this.provider.send({
        to: dto.to,
        subject,
        html: rendered.html,
        text: rendered.text,
        attachments: trigger.staticAttachments,
      });
      await this.logRepo.update(log.id, {
        status: 'sent',
        sentAt: new Date(),
        providerMessageId,
      });
    } catch (err) {
      await this.logRepo.update(log.id, {
        status: 'failed',
        errorMessage:
          err instanceof Error ? err.message : 'Unknown delivery error',
      });
      throw err;
    }

    await this.audit.record(
      'email_template.test_sent',
      'email_template',
      templateId,
      actorUserId ?? undefined,
      {
        versionId: version.id,
        to: dto.to,
      },
    );

    return { success: true, logId: log.id };
  }

  // Blasts a published broadcast version to a chosen sponsor segment. Unlike
  // the coded triggers (one resolved template per triggerKey+locale), many
  // broadcast campaigns share BROADCAST_TRIGGER_KEY — so each recipient's
  // send carries this exact templateId, letting MailProcessor resolve the
  // precise version directly instead of going through the ambiguous
  // triggerKey-based fallback chain.
  async broadcastSend(
    templateId: string,
    dto: BroadcastSendDto,
    actorUserId: string | null,
  ) {
    const template = await this.findTemplateOrThrow(templateId);
    if (template.kind !== 'broadcast') {
      throw new ConflictException(
        'Only broadcast templates can be sent this way',
      );
    }

    const version = await this.getVersion(templateId, dto.versionId);
    if (version.status !== 'published') {
      throw new ConflictException(
        'Publish this broadcast before sending it to sponsors',
      );
    }

    const sponsors = await resolveAudienceSponsors(
      this.sponsorRepo,
      dto.audience,
    );
    if (sponsors.length === 0) {
      throw new ConflictException('No recipients match this audience');
    }

    await Promise.all(
      sponsors.map((sponsor) =>
        this.mailService.send({
          triggerKey: BROADCAST_TRIGGER_KEY,
          templateId: template.id,
          to: sponsor.email,
          locale: template.locale,
          data: {
            sponsor: {
              name: sponsor.name,
              child: sponsor.child ? { name: sponsor.child.name } : undefined,
            },
            unsubscribeUrl: buildUnsubscribeUrl(sponsor.unsubscribeToken),
          },
        }),
      ),
    );

    await this.audit.record(
      'email_template.broadcast_sent',
      'email_template',
      templateId,
      actorUserId ?? undefined,
      {
        versionId: version.id,
        audience: dto.audience,
        recipientCount: sponsors.length,
      },
    );

    return { success: true, recipientCount: sponsors.length };
  }

  private async resolveLayoutHtml(layoutId: string | null): Promise<string> {
    const layout = layoutId
      ? await this.layoutRepo.findOne({ where: { id: layoutId } })
      : await this.layoutRepo.findOne({ where: { key: 'default' } });
    return layout?.bodyHtml ?? PASSTHROUGH_LAYOUT_HTML;
  }

  private async nextVersionNumber(templateId: string): Promise<number> {
    const raw = await this.versionRepo
      .createQueryBuilder('v')
      .select('MAX(v.versionNumber)', 'max')
      .where('v.templateId = :templateId', { templateId })
      .getRawOne<{ max: string | null }>();
    return (Number(raw?.max) || 0) + 1;
  }

  private async findTemplateOrThrow(id: string): Promise<EmailTemplate> {
    const template = await this.templateRepo.findOne({ where: { id } });
    if (!template)
      throw new NotFoundException(`Email template ${id} not found`);
    return template;
  }
}
