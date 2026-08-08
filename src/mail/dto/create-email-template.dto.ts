import {
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { SUPPORTED_LOCALE_VALUES } from '../mail.constants';

export class CreateEmailTemplateDto {
  @IsOptional() @IsIn(['trigger', 'broadcast']) kind?: 'trigger' | 'broadcast';

  // Required unless creating a broadcast, where the triggerKey is a fixed
  // reserved constant assigned server-side and never comes from the client.
  @ValidateIf(
    (o: CreateEmailTemplateDto) => (o.kind ?? 'trigger') === 'trigger',
  )
  @IsString()
  triggerKey?: string;

  // Required only for broadcasts — the staff-facing label shown in the list,
  // since there's no registry name to fall back on.
  @ValidateIf((o: CreateEmailTemplateDto) => o.kind === 'broadcast')
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional() @IsIn(SUPPORTED_LOCALE_VALUES) locale?: string;
}
