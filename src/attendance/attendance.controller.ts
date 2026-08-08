import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AttendanceService } from './attendance.service';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { UpdateAttendanceDayDto } from './dto/update-attendance-day.dto';
import { QueryAttendanceDaysDto } from './dto/query-attendance-days.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserRole } from '../users/enums/user-role.enum';

const MANAGERS = [UserRole.ADMIN, UserRole.STAFF, UserRole.SPONSORSHIP_MANAGER];

@Controller('attendance')
@Roles(...MANAGERS)
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Get('days')
  listDays(@Query() query: QueryAttendanceDaysDto) {
    return this.attendance.listDays(query);
  }

  @Get('days/:date')
  getDay(@Param('date') date: string) {
    return this.attendance.getDayDetail(date);
  }

  @Patch('days/:date')
  updateDay(
    @Param('date') date: string,
    @Body() dto: UpdateAttendanceDayDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.updateDay(date, dto, user.id);
  }

  @Post('days/:date/records')
  @HttpCode(200)
  setStatus(
    @Param('date') date: string,
    @Body() dto: MarkAttendanceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.setStatus(
      date,
      dto.childId,
      dto.status ?? AttendanceStatus.PRESENT,
      dto.note,
      user.id,
    );
  }

  @Post('days/:date/mark-remaining')
  @HttpCode(200)
  markRemainingPresent(
    @Param('date') date: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.attendance.markRemainingPresent(date, user.id);
  }

  @Delete('days/:date/records')
  resetDay(@Param('date') date: string) {
    return this.attendance.resetDay(date);
  }

  @Delete('days/:date/records/:childId')
  unmark(@Param('date') date: string, @Param('childId') childId: string) {
    return this.attendance.unmark(date, childId);
  }

  @Get('days/:date/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Param('date') date: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-${date}.csv"`,
    );
    return this.attendance.exportCsv(date);
  }

  // A returned Buffer isn't sent as raw bytes by Nest's default response
  // handling (even with @Header() + passthrough, it gets JSON-serialized as
  // {"type":"Buffer","data":[...]}) — @Res() without passthrough plus an
  // explicit res.send(buffer) is required to actually stream binary PDF
  // bytes. The string CSV route above doesn't need this: Nest's Express
  // adapter sends a returned string via res.send() natively.
  @Get('days/:date/export.pdf')
  async exportPdf(@Param('date') date: string, @Res() res: Response) {
    const pdf = await this.attendance.exportPdf(date);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="attendance-${date}.pdf"`,
    );
    res.send(pdf);
  }

  @Get('children/:childId')
  getChildHistory(@Param('childId') childId: string) {
    return this.attendance.getChildHistory(childId);
  }
}
