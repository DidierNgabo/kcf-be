import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { EmailTemplatesService } from '../email-templates.service';

@Controller('mail/triggers')
export class MailTriggersController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SPONSORSHIP_MANAGER)
  @Get()
  list() {
    return this.service.listTriggers();
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SPONSORSHIP_MANAGER)
  @Get(':key')
  get(@Param('key') key: string) {
    return this.service.getTrigger(key);
  }
}
