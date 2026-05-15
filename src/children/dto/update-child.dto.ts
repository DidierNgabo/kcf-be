import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateChildDto {
  @IsString() @IsOptional() name?: string;
  @IsInt() @Min(1) @IsOptional() age?: number;
  @IsString() @IsOptional() imageUrl?: string;
  @IsString() @IsOptional() bio?: string;
  @IsString() @IsOptional() subject?: string;
  @IsString() @IsOptional() dream?: string;
  @IsString() @IsOptional() hobby?: string;
  @IsString() @IsOptional() personality?: string;
  @IsString() @IsOptional() family?: string;
  @IsString() @IsOptional() location?: string;
  @IsString() @IsOptional() uniqueQuality?: string;
  @IsString() @IsOptional() gender?: string;
  @IsDateString() @IsOptional() dateOfBirth?: string;
  @IsString() @IsOptional() schoolName?: string;
  @IsString() @IsOptional() schoolLevel?: string;
  @IsString() @IsOptional() schoolYearGroup?: string;
  @IsDateString() @IsOptional() enrolmentDate?: string;
  @IsString() @IsOptional() guardianName?: string;
  @IsString() @IsOptional() guardianRelationship?: string;
  @IsBoolean() @IsOptional() guardianConsent?: boolean;
  @IsBoolean() @IsOptional() photoConsentStatus?: boolean;
  @IsDateString() @IsOptional() sponsorshipStartDate?: string;
}
