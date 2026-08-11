import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RequestAssetUploadDto {
  @IsString() @IsNotEmpty() filename: string;
  @IsString() @IsNotEmpty() mimeType: string;
  @IsInt() @Min(1) @Max(5 * 1024 * 1024) sizeBytes: number;
  @IsString() @IsOptional() checksum?: string;
}

export class ConfirmAssetUploadDto extends RequestAssetUploadDto {
  @IsString() @IsNotEmpty() objectKey: string;
}
