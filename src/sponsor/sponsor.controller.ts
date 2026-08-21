import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { SponsorService } from './sponsor.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { MatchSponsorDto } from './dto/match-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { QuerySponsorsDto } from './dto/query-sponsors.dto';
import { UpdateSponsorPreferencesDto } from './dto/update-sponsor-preferences.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('sponsor')
export class SponsorController {
  constructor(private readonly sponsorService: SponsorService) {}

  @Roles(UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER)
  @Get()
  findAll(@Query() query: QuerySponsorsDto) {
    return this.sponsorService.findAll(query);
  }

  @Roles(UserRole.ADMIN)
  @Get('audience-counts')
  audienceCounts() {
    return this.sponsorService.audienceCounts();
  }

  @Roles(UserRole.SPONSOR)
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser) {
    if (!user.sponsorId) {
      throw new NotFoundException('No sponsor record linked to this account');
    }
    return this.sponsorService.findById(user.sponsorId);
  }

  @Roles(UserRole.SPONSOR)
  @Patch('me/preferences')
  updateMyPreferences(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateSponsorPreferencesDto,
  ) {
    if (!user.sponsorId) {
      throw new NotFoundException('No sponsor record linked to this account');
    }
    return this.sponsorService.updatePreferences(user.sponsorId, dto);
  }

  @Public()
  @Post()
  @HttpCode(200)
  submit(@Body() dto: CreateSponsorDto) {
    return this.sponsorService.submit(dto).then(() => ({ success: true }));
  }

  @Roles(UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER)
  @Post('match')
  @HttpCode(200)
  match(@Body() dto: MatchSponsorDto) {
    return this.sponsorService.match(dto).then(() => ({ success: true }));
  }

  @Roles(UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSponsorDto) {
    return this.sponsorService.update(id, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sponsorService.findById(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER)
  @Get(':id/emails')
  listEmails(@Param('id') id: string) {
    return this.sponsorService.listEmails(id);
  }

  @Roles(UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER)
  @Post(':id/emails/:triggerKey/resend')
  @HttpCode(200)
  resendEmail(
    @Param('id') id: string,
    @Param('triggerKey') triggerKey: string,
  ) {
    return this.sponsorService
      .resendEmail(id, triggerKey)
      .then(() => ({ success: true }));
  }

  @Public()
  @Post('unsubscribe/:token')
  @HttpCode(200)
  unsubscribe(@Param('token') token: string) {
    return this.sponsorService.unsubscribeByToken(token);
  }
}
