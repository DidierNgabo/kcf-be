import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../../users/enums/user-role.enum';
import { EmailAssetsService } from '../email-assets.service';
import {
  ConfirmAssetUploadDto,
  RequestAssetUploadDto,
} from '../dto/email-asset.dto';

const READ_ROLES = [
  UserRole.ADMIN,
  UserRole.STAFF,
  UserRole.SPONSORSHIP_MANAGER,
];
const WRITE_ROLES = [UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER];

@Controller('mail/assets')
export class EmailAssetsController {
  constructor(private readonly service: EmailAssetsService) {}

  @Roles(...READ_ROLES)
  @Get()
  list() {
    return this.service.list();
  }

  @Roles(...WRITE_ROLES)
  @Post('upload-url')
  @HttpCode(200)
  requestUpload(@Body() dto: RequestAssetUploadDto) {
    return this.service.requestUpload(dto);
  }

  @Roles(...WRITE_ROLES)
  @Post('confirm')
  confirm(
    @Body() dto: ConfirmAssetUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.confirm(dto, user.id);
  }
}
