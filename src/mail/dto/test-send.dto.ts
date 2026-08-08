import { IsEmail, IsObject, IsOptional, IsUUID } from 'class-validator';

export class TestSendDto {
  @IsEmail() to: string;

  @IsOptional() @IsUUID() versionId?: string;

  @IsOptional() @IsObject() sampleData?: Record<string, unknown>;
}
