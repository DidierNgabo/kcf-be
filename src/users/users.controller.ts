import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateSponsorAccountDto } from './dto/create-sponsor-account.dto';
import { UserRole } from './enums/user-role.enum';
import { Roles } from '../auth/decorators/roles.decorator';
import { QueryUsersDto } from './dto/query-users.dto';

@Controller('users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post('sponsor-accounts')
  @Roles(UserRole.ADMIN, UserRole.SPONSORSHIP_MANAGER)
  @HttpCode(201)
  createSponsorAccount(@Body() dto: CreateSponsorAccountDto) {
    return this.usersService.createSponsorAccount(dto);
  }

  @Get()
  findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }
}
