import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { MediaCategory } from '../enums/child.enums';

export class RequestMediaUploadDto {
  @IsString() @IsNotEmpty() filename: string;
  @IsString() @IsNotEmpty() mimeType: string;
  @IsInt() @Min(1) @Max(20 * 1024 * 1024) sizeBytes: number;
  @IsEnum(MediaCategory) category: MediaCategory;
  @IsString() @IsOptional() checksum?: string;
}

export class ConfirmMediaUploadDto extends RequestMediaUploadDto {
  @IsString() @IsNotEmpty() objectKey: string;
  @IsString() @IsOptional() caption?: string;
}

export class UpdateMediaDto {
  @IsEnum(MediaCategory) @IsOptional() category?: MediaCategory;
  @IsString() @IsOptional() caption?: string;
}
