import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SponsorController } from './sponsor.controller';
import { SponsorService } from './sponsor.service';
import { MailtrapContactsService } from './mailtrap-contacts.service';
import { FollowUpService } from './follow-up.service';
import { Sponsor } from './entities/sponsor.entity';
import { ChildrenModule } from '../children/children.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sponsor]), ChildrenModule],
  controllers: [SponsorController],
  providers: [SponsorService, MailtrapContactsService, FollowUpService],
})
export class SponsorModule {}
