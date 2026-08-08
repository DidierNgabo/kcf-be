import { Type } from 'class-transformer';
import {
  IsBoolean, IsDateString, IsEmail, IsEnum, IsNotEmpty, IsOptional,
  IsString, Matches, ValidateNested,
} from 'class-validator';
import { ConsentStatus } from '../enums/child.enums';

export class EducationInputDto {
  @IsString() @IsOptional() schoolName?: string;
  @IsString() @IsOptional() schoolLevel?: string;
  @IsString() @IsOptional() yearGroup?: string;
  @IsDateString() @IsOptional() startedAt?: string;
}

export class GuardianInputDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsNotEmpty() relationship: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
}

export class ConsentInputDto {
  @IsEnum(ConsentStatus) guardian: ConsentStatus;
  @IsEnum(ConsentStatus) photo: ConsentStatus;
  @IsString() @IsOptional() notes?: string;
}

export class CreateChildDto {
  @IsString() @Matches(/^[A-Za-z0-9-]{3,40}$/) kcfNumber: string;
  @IsString() @IsNotEmpty() name: string;
  @IsString() @IsOptional() gender?: string;
  @IsDateString() @IsOptional() dateOfBirth?: string;
  @IsDateString() @IsOptional() enrolmentDate?: string;
  @IsString() @IsOptional() bio?: string;
  @IsString() @IsOptional() subject?: string;
  @IsString() @IsOptional() dream?: string;
  @IsString() @IsOptional() hobby?: string;
  @IsString() @IsOptional() personality?: string;
  @IsString() @IsOptional() family?: string;
  @IsString() @IsOptional() location?: string;
  @IsString() @IsOptional() uniqueQuality?: string;

  @ValidateNested() @Type(() => EducationInputDto) @IsOptional()
  education?: EducationInputDto;
  @ValidateNested({ each: true }) @Type(() => GuardianInputDto) @IsOptional()
  guardians?: GuardianInputDto[];
  @ValidateNested() @Type(() => ConsentInputDto) @IsOptional()
  consent?: ConsentInputDto;
}
