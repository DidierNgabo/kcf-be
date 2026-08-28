import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SponsorController } from './sponsor.controller';
import { SponsorService } from './sponsor.service';
import { FollowUpService } from './follow-up.service';
import { Sponsor } from './entities/sponsor.entity';
import { ChildrenModule } from '../children/children.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sponsor]),
    ChildrenModule,
    MailModule,
    UsersModule,
    StorageModule,
  ],
  controllers: [SponsorController],
  providers: [SponsorService, FollowUpService],
})
export class SponsorModule {}
