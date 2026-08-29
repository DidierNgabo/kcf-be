import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateSponsorPreferencesDto {
  @IsOptional() @IsString() @MaxLength(2000) childInterests?: string;
  @IsOptional() @IsString() @MaxLength(2000) schoolGoals?: string;
  @IsOptional() @IsString() @MaxLength(2000) hobbiesAndTalents?: string;
  @IsOptional() @IsString() @MaxLength(2000) communicationPreferences?: string;
  @IsOptional() @IsString() @MaxLength(50) childGenderPreference?: string;
  @IsOptional() @IsDateString({ strict: true }) birthday?: string;
  @IsOptional() @IsBoolean() birthdaySkipped?: boolean;
}
