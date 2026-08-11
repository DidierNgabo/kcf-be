import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SponsorController } from './sponsor.controller';
import { FollowUpSettingsController } from './follow-up-settings.controller';
import { SponsorService } from './sponsor.service';
import { MailtrapContactsService } from './mailtrap-contacts.service';
import { FollowUpService } from './follow-up.service';
import { Sponsor } from './entities/sponsor.entity';
import { FollowUpSettings } from './entities/follow-up-settings.entity';
import { ChildrenModule } from '../children/children.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sponsor, FollowUpSettings]),
    ChildrenModule,
    MailModule,
    UsersModule,
    StorageModule,
  ],
  controllers: [SponsorController, FollowUpSettingsController],
  providers: [SponsorService, MailtrapContactsService, FollowUpService],
})
export class SponsorModule {}
