import { Body, Controller, Get, Patch } from '@nestjs/common';
import { FollowUpService } from './follow-up.service';
import { UpdateFollowUpSettingsDto } from './dto/update-follow-up-settings.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('follow-up-settings')
@Roles(UserRole.ADMIN)
export class FollowUpSettingsController {
  constructor(private readonly followUpService: FollowUpService) {}

  @Get()
  get() {
    return this.followUpService.getSettings();
  }

  @Patch()
  update(
    @Body() dto: UpdateFollowUpSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.followUpService.updateSettings(dto, user.id);
  }
}
