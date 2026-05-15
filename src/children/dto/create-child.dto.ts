import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateChildDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsInt()
  @Min(1)
  age: number;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsString()
  @IsNotEmpty()
  bio: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  dream: string;

  @IsString()
  @IsNotEmpty()
  hobby: string;

  @IsString()
  @IsNotEmpty()
  personality: string;

  @IsString()
  @IsNotEmpty()
  family: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsString()
  @IsNotEmpty()
  uniqueQuality: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  schoolName?: string;

  @IsString()
  @IsOptional()
  schoolLevel?: string;

  @IsString()
  @IsOptional()
  schoolYearGroup?: string;

  @IsDateString()
  @IsOptional()
  enrolmentDate?: string;

  @IsString()
  @IsOptional()
  guardianName?: string;

  @IsString()
  @IsOptional()
  guardianRelationship?: string;

  @IsBoolean()
  @IsOptional()
  guardianConsent?: boolean;

  @IsBoolean()
  @IsOptional()
  photoConsentStatus?: boolean;

  @IsDateString()
  @IsOptional()
  sponsorshipStartDate?: string;
}
