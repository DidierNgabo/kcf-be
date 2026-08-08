import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AttendanceStatus } from '../enums/attendance-status.enum';

export class MarkAttendanceDto {
  @IsUUID()
  childId: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus = AttendanceStatus.PRESENT;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
