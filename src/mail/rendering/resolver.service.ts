import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailTemplate } from '../entities/email-template.entity';
import { EmailTemplateVersion } from '../entities/email-template-version.entity';
import { EmailLayout } from '../entities/email-layout.entity';
import { TriggerRegistryService } from '../registry/trigger-registry.service';
import { CachedTemplate, TemplateCacheService } from './template-cache.service';

const DEFAULT_LOCALE = 'default';
const PASSTHROUGH_LAYOUT_HTML = '{{{body}}}';

export interface ResolvedTemplate extends CachedTemplate {
  fromCodeDefault: boolean;
}

/**
 * Resolves (triggerKey, locale) to renderable template content. Never
 * throws — a missing/broken DB template always falls through to the
 * code-shipped trigger default, so transactional email can never silently
 * stop just because staff haven't created (or broke) a row for it.
 */
@Injectable()
export class TemplateResolverService {
  private readonly logger = new Logger(TemplateResolverService.name);

  constructor(
    @InjectRepository(EmailTemplate)
    private readonly templateRepo: Repository<EmailTemplate>,
    @InjectRepository(EmailTemplateVersion)
    private readonly versionRepo: Repository<EmailTemplateVersion>,
    @InjectRepository(EmailLayout)
    private readonly layoutRepo: Repository<EmailLayout>,
    private readonly registry: TriggerRegistryService,
    private readonly cache: TemplateCacheService,
  ) {}

  async resolve(
    triggerKey: string,
    locale: string = DEFAULT_LOCALE,
  ): Promise<ResolvedTemplate> {
    const cached = await this.cache.get(triggerKey, locale);
    if (cached)
      return { ...cached, fromCodeDefault: cached.templateId === null };

    const resolved = await this.resolveUncached(triggerKey, locale);
    await this.cache.set(triggerKey, locale, resolved);
    return { ...resolved, fromCodeDefault: resolved.templateId === null };
  }

  private async resolveUncached(
    triggerKey: string,
    locale: string,
  ): Promise<CachedTemplate> {
    try {
      const atLocale = await this.findPublished(triggerKey, locale);
      if (atLocale) return atLocale;

      if (locale !== DEFAULT_LOCALE) {
        const atDefaultLocale = await this.findPublished(
          triggerKey,
          DEFAULT_LOCALE,
        );
        if (atDefaultLocale) return atDefaultLocale;
      }
    } catch (err) {
      this.logger.error(
        `DB lookup failed while resolving template for '${triggerKey}'/'${locale}'; falling back to code default`,
        err instanceof Error ? err.stack : err,
      );
    }

    this.logger.warn(
      `No published template for '${triggerKey}'; using code default`,
    );
    const trigger = this.registry.getByKey(triggerKey);
    return {
      templateId: null,
      versionId: null,
      subjectTemplate: trigger.defaults.subject,
      bodyTemplate: trigger.defaults.bodyHtml,
      layoutHtml: PASSTHROUGH_LAYOUT_HTML,
    };
  }

  // Used by broadcast sends, which already know the exact template — unlike
  // resolve(), this is a literal lookup, not a fallback chain: throwing on a
  // missing/unpublished template is correct here since the caller (
  // EmailTemplatesService.broadcastSend) has already verified the version is
  // published moments earlier, so a failure here is a genuine, worth-surfacing
  // inconsistency rather than a normal "nothing configured yet" case.
  async resolveByTemplateId(templateId: string): Promise<ResolvedTemplate> {
    const template = await this.templateRepo.findOne({
      where: { id: templateId },
    });
    if (!template) throw new Error(`Template ${templateId} not found`);

    const version = await this.versionRepo.findOne({
      where: { templateId, status: 'published' },
    });
    if (!version)
      throw new Error(`Template ${templateId} has no published version`);

    const layout = template.layoutId
      ? await this.layoutRepo.findOne({ where: { id: template.layoutId } })
      : await this.layoutRepo.findOne({ where: { key: 'default' } });

    return {
      templateId: template.id,
      versionId: version.id,
      subjectTemplate: version.subject,
      bodyTemplate: version.bodyHtml,
      layoutHtml: layout?.bodyHtml ?? PASSTHROUGH_LAYOUT_HTML,
      fromCodeDefault: false,
    };
  }

  private async findPublished(
    triggerKey: string,
    locale: string,
  ): Promise<CachedTemplate | null> {
    const template = await this.templateRepo.findOne({
      where: { triggerKey, locale, channel: 'email' },
    });
    if (!template) return null;

    const version = await this.versionRepo.findOne({
      where: { templateId: template.id, status: 'published' },
    });
    if (!version) return null;

    const layout = template.layoutId
      ? await this.layoutRepo.findOne({ where: { id: template.layoutId } })
      : await this.layoutRepo.findOne({ where: { key: 'default' } });

    return {
      templateId: template.id,
      versionId: version.id,
      subjectTemplate: version.subject,
      bodyTemplate: version.bodyHtml,
      layoutHtml: layout?.bodyHtml ?? PASSTHROUGH_LAYOUT_HTML,
    };
  }
}
