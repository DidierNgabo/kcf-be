import { Module } from '@nestjs/common';
import { SponsorController } from './sponsor.controller';
import { SponsorService } from './sponsor.service';
import { MailtrapContactsService } from './mailtrap-contacts.service';

@Module({
  controllers: [SponsorController],
  providers: [SponsorService, MailtrapContactsService],
})
export class SponsorModule {}
