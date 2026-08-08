import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAttendanceDayDto {
  @IsOptional() @IsString() @MaxLength(200) label?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}
