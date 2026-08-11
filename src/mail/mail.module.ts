import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscoveryModule } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { EmailLayout } from './entities/email-layout.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { EmailTemplateVersion } from './entities/email-template-version.entity';
import { EmailLog } from './entities/email-log.entity';
import { EmailAsset } from './entities/email-asset.entity';
import { TriggerRegistryService } from './registry/trigger-registry.service';
import { TemplateResolverService } from './rendering/resolver.service';
import { TemplateCacheService } from './rendering/template-cache.service';
import { RendererService } from './rendering/renderer.service';
import { MailtrapProviderAdapter } from './provider/mailtrap-provider.adapter';
import { MailProcessor } from './queue/mail.processor';
import { MailService } from './mail.service';
import { EmailTemplatesService } from './email-templates.service';
import { MAIL_QUEUE_NAME } from './queue/mail-queue.constants';
import {
  mailRedisConnection,
  MailRedisLifecycle,
} from './queue/redis-connection';
import { MailTriggersController } from './controllers/mail-triggers.controller';
import { EmailLayoutsController } from './controllers/email-layouts.controller';
import { EmailTemplatesController } from './controllers/email-templates.controller';
import { EmailAssetsController } from './controllers/email-assets.controller';
import { EmailAssetsService } from './email-assets.service';
import { StorageModule } from '../storage/storage.module';

import { SponsorAcknowledgmentTrigger } from './triggers/sponsor-acknowledgment.trigger';
import { SponsorInquiryReceivedTrigger } from './triggers/sponsor-inquiry-received.trigger';
import { SponsorMatchedTrigger } from './triggers/sponsor-matched.trigger';
import { SponsorProfileReminderTrigger } from './triggers/sponsor-profile-reminder.trigger';
import { UserStaffInvitationTrigger } from './triggers/user-staff-invitation.trigger';
import { UserAccountProvisionedTrigger } from './triggers/user-account-provisioned.trigger';
import { UserPasswordResetTrigger } from './triggers/user-password-reset.trigger';
import { ManualBroadcastTrigger } from './triggers/manual-broadcast.trigger';
import { Sponsor } from '../sponsor/entities/sponsor.entity';

const TRIGGERS = [
  SponsorAcknowledgmentTrigger,
  SponsorInquiryReceivedTrigger,
  SponsorMatchedTrigger,
  SponsorProfileReminderTrigger,
  UserStaffInvitationTrigger,
  UserAccountProvisionedTrigger,
  UserPasswordResetTrigger,
  ManualBroadcastTrigger,
];

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailLayout,
      EmailTemplate,
      EmailTemplateVersion,
      EmailLog,
      EmailAsset,
      Sponsor,
    ]),
    DiscoveryModule,
    StorageModule,
    BullModule.forRoot({ connection: mailRedisConnection }),
    BullModule.registerQueue({ name: MAIL_QUEUE_NAME }),
  ],
  controllers: [
    MailTriggersController,
    EmailLayoutsController,
    EmailTemplatesController,
    EmailAssetsController,
  ],
  providers: [
    ...TRIGGERS,
    TriggerRegistryService,
    TemplateResolverService,
    TemplateCacheService,
    RendererService,
    MailtrapProviderAdapter,
    MailProcessor,
    MailService,
    EmailTemplatesService,
    EmailAssetsService,
    MailRedisLifecycle,
  ],
  exports: [MailService],
})
export class MailModule {}
