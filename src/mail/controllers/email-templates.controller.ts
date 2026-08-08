import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/enums/user-role.enum';
import { EmailTemplatesService } from '../email-templates.service';
import { CreateEmailTemplateDto } from '../dto/create-email-template.dto';
import { UpdateEmailTemplateDto } from '../dto/update-email-template.dto';
import { SaveTemplateVersionDto } from '../dto/save-template-version.dto';
import { PreviewTemplateDto } from '../dto/preview-template.dto';
import { TestSendDto } from '../dto/test-send.dto';
import { BroadcastSendDto } from '../dto/broadcast-send.dto';

const READ_ROLES = [
  UserRole.ADMIN,
  UserRole.STAFF,
  UserRole.SPONSORSHIP_MANAGER,
];
const WRITE_ROLES = [UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER];
const PUBLISH_ROLES = [UserRole.ADMIN];

@Controller('mail/templates')
export class EmailTemplatesController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Roles(...READ_ROLES)
  @Get()
  list() {
    return this.service.list();
  }

  @Roles(...WRITE_ROLES)
  @Post()
  create(
    @Body() dto: CreateEmailTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(dto, user.id);
  }

  @Roles(...READ_ROLES)
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Roles(...WRITE_ROLES)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEmailTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateMetadata(id, dto, user.id);
  }

  @Roles(...READ_ROLES)
  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.service.listVersions(id);
  }

  @Roles(...READ_ROLES)
  @Get(':id/versions/:versionId')
  getVersion(@Param('id') id: string, @Param('versionId') versionId: string) {
    return this.service.getVersion(id, versionId);
  }

  @Roles(...WRITE_ROLES)
  @Post(':id/versions')
  @HttpCode(200)
  saveDraft(
    @Param('id') id: string,
    @Body() dto: SaveTemplateVersionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.saveDraft(id, dto, user.id);
  }

  @Roles(...PUBLISH_ROLES)
  @Post(':id/versions/:versionId/publish')
  @HttpCode(200)
  publish(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.publish(id, versionId, user.id);
  }

  @Roles(...PUBLISH_ROLES)
  @Post(':id/versions/:versionId/rollback')
  @HttpCode(200)
  rollback(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.rollback(id, versionId, user.id);
  }

  @Roles(...READ_ROLES)
  @Post(':id/preview')
  @HttpCode(200)
  preview(@Param('id') id: string, @Body() dto: PreviewTemplateDto) {
    return this.service.preview(id, dto);
  }

  @Roles(...WRITE_ROLES)
  @Post(':id/test-send')
  @HttpCode(200)
  testSend(
    @Param('id') id: string,
    @Body() dto: TestSendDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.testSend(id, dto, user.id);
  }

  @Roles(...PUBLISH_ROLES)
  @Post(':id/broadcast-send')
  @HttpCode(200)
  broadcastSend(
    @Param('id') id: string,
    @Body() dto: BroadcastSendDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.broadcastSend(id, dto, user.id);
  }
}
