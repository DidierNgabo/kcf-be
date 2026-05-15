import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { SponsorService } from './sponsor.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { MatchSponsorDto } from './dto/match-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';

@Controller('sponsor')
export class SponsorController {
  constructor(private readonly sponsorService: SponsorService) {}

  @Get()
  findAll() {
    return this.sponsorService.findAll();
  }

  @Post()
  @HttpCode(200)
  submit(@Body() dto: CreateSponsorDto) {
    return this.sponsorService.submit(dto).then(() => ({ success: true }));
  }

  @Post('match')
  @HttpCode(200)
  match(@Body() dto: MatchSponsorDto) {
    return this.sponsorService.match(dto).then(() => ({ success: true }));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSponsorDto) {
    return this.sponsorService.update(id, dto);
  }
}
