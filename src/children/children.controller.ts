import {
  Body, Controller, Get, Header, HttpCode, Param, Patch, Post, Query,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/enums/user-role.enum';
import { ChildImportService } from './child-import.service';
import { ChildMediaService } from './child-media.service';
import { ChildrenService } from './children.service';
import { CreateChildDto } from './dto/create-child.dto';
import { ConfirmMediaUploadDto, RequestMediaUploadDto, UpdateMediaDto } from './dto/media.dto';
import { QueryChildrenDto } from './dto/query-children.dto';
import { UpdateChildDto } from './dto/update-child.dto';

const MANAGERS = [UserRole.ADMIN, UserRole.STAFF, UserRole.SPONSORSHIP_MANAGER];

@Controller('children')
@Roles(...MANAGERS)
export class ChildrenController {
  constructor(
    private readonly children: ChildrenService,
    private readonly imports: ChildImportService,
    private readonly media: ChildMediaService,
  ) {}

  @Get() findAll(@Query() query: QueryChildrenDto) { return this.children.findAll(query); }

  @Post() @HttpCode(201)
  create(@Body() dto: CreateChildDto, @CurrentUser() user: AuthenticatedUser) {
    return this.children.create(dto, user.id);
  }

  @Post('imports/preview')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  preview(@UploadedFile() file: Express.Multer.File, @CurrentUser() user: AuthenticatedUser) {
    return this.imports.preview(file, user.id);
  }

  @Get('imports/:id')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  importDetails(@Param('id') id: string) { return this.imports.findOne(id); }

  @Post('imports/:id/commit')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  commit(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.imports.commit(id, user.id);
  }

  @Get('imports/:id/error-report')
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="child-import-report.csv"')
  errorReport(@Param('id') id: string) { return this.imports.errorReport(id); }

  @Get(':id') findOne(@Param('id') id: string) { return this.children.findById(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChildDto, @CurrentUser() user: AuthenticatedUser) {
    return this.children.update(id, dto, user.id);
  }

  @Post(':id/archive') archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.children.archive(id, user.id); }
  @Post(':id/restore') @Roles(UserRole.ADMIN, UserRole.STAFF)
  restore(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) { return this.children.restore(id, user.id); }

  @Post(':id/media/upload-url')
  uploadUrl(@Param('id') id: string, @Body() dto: RequestMediaUploadDto) {
    return this.media.requestUpload(id, dto);
  }
  @Post(':id/media/confirm')
  confirmMedia(@Param('id') id: string, @Body() dto: ConfirmMediaUploadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.media.confirm(id, dto, user.id);
  }
  @Get(':id/media/:mediaId/access-url')
  accessMedia(@Param('id') id: string, @Param('mediaId') mediaId: string) {
    return this.media.accessUrl(id, mediaId);
  }
  @Patch(':id/media/:mediaId')
  updateMedia(@Param('id') id: string, @Param('mediaId') mediaId: string, @Body() dto: UpdateMediaDto, @CurrentUser() user: AuthenticatedUser) {
    return this.media.update(id, mediaId, dto, user.id);
  }
  @Post(':id/media/:mediaId/archive')
  archiveMedia(@Param('id') id: string, @Param('mediaId') mediaId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.media.archive(id, mediaId, user.id);
  }
}
