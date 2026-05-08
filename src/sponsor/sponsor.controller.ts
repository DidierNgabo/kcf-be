import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SponsorService } from './sponsor.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';

@Controller('sponsor')
export class SponsorController {
  constructor(private readonly sponsorService: SponsorService) {}

  @Post()
  @HttpCode(200)
  submit(@Body() dto: CreateSponsorDto) {
    return this.sponsorService.submit(dto).then(() => ({ success: true }));
  }
}
