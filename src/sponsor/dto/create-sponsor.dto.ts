import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSponsorDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
