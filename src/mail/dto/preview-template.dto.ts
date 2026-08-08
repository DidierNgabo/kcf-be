import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PreviewTemplateDto {
  @IsString() @MaxLength(500) subject: string;

  @IsString() @MaxLength(100_000) bodyHtml: string;

  @IsOptional() @IsObject() sampleData?: Record<string, unknown>;
}
