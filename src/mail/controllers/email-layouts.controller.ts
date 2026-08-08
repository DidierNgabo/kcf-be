import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { EmailTemplatesService } from '../email-templates.service';

@Controller('mail/layouts')
export class EmailLayoutsController {
  constructor(private readonly service: EmailTemplatesService) {}

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SPONSORSHIP_MANAGER)
  @Get()
  list() {
    return this.service.listLayouts();
  }

  @Roles(UserRole.ADMIN, UserRole.STAFF, UserRole.SPONSORSHIP_MANAGER)
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.getLayout(id);
  }
}
