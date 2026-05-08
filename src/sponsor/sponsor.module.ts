import { Module } from '@nestjs/common';
import { SponsorController } from './sponsor.controller';
import { SponsorService } from './sponsor.service';

@Module({
  controllers: [SponsorController],
  providers: [SponsorService],
})
export class SponsorModule {}
