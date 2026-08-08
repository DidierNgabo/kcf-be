import {
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class CreateSponsorAccountDto {
  @IsUUID()
  sponsorId: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  // Set by internal callers (the follow-up cron) that fold the credentials
  // into their own email instead — avoids sending both
  // user.account-provisioned AND the caller's own email back to back.
  @IsOptional()
  @IsBoolean()
  skipEmail?: boolean;
}
