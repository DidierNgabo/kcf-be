import { IsOptional, IsUUID } from 'class-validator';

export class UpdateEmailTemplateDto {
  @IsOptional() @IsUUID() layoutId?: string | null;
}
