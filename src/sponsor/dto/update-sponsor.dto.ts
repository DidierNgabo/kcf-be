import { IsOptional, IsString } from 'class-validator';

export class UpdateSponsorDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() message?: string;
}
