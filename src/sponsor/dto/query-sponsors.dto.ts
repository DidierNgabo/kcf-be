import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QuerySponsorsDto {
  @IsString() @IsOptional() search?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) @IsOptional() limit = 20;
}
