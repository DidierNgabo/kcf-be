import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QuerySponsorsDto {
  @IsString() @IsOptional() search?: string;
  @IsIn(['all', 'matched', 'unmatched']) @IsOptional() match = 'all';
  @IsIn(['true', 'false']) @IsOptional() active?: 'true' | 'false';
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) @IsOptional() limit = 20;
}
