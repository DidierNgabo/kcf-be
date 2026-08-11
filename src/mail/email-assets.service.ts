import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { STORAGE_SERVICE } from '../storage/storage.types';
import type { StorageService } from '../storage/storage.types';
import { EmailAsset } from './entities/email-asset.entity';
import {
  ConfirmAssetUploadDto,
  RequestAssetUploadDto,
} from './dto/email-asset.dto';
import { AuditService } from '../audit/audit.service';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const MAX_SIZE = 5 * 1024 * 1024;
const OBJECT_PREFIX = 'email-assets/';

@Injectable()
export class EmailAssetsService {
  constructor(
    @InjectRepository(EmailAsset)
    private readonly assetRepo: Repository<EmailAsset>,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async requestUpload(dto: RequestAssetUploadDto) {
    this.validateFile(dto.mimeType, dto.sizeBytes);
    const extension =
      dto.filename
        .split('.')
        .pop()
        ?.replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase() || 'bin';
    const objectKey = `${OBJECT_PREFIX}${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`;
    const expiresIn = this.config.get<number>('R2_UPLOAD_URL_TTL_SECONDS', 600);
    return {
      objectKey,
      uploadUrl: await this.storage.createUploadUrl({
        objectKey,
        mimeType: dto.mimeType,
        checksum: dto.checksum,
        expiresIn,
      }),
      uploadHeaders: { 'Content-Type': dto.mimeType },
      url: this.storage.getPublicUrl(objectKey),
      expiresIn,
    };
  }

  async confirm(dto: ConfirmAssetUploadDto, userId?: string) {
    if (!dto.objectKey.startsWith(OBJECT_PREFIX)) {
      throw new BadRequestException('Invalid object key');
    }
    this.validateFile(dto.mimeType, dto.sizeBytes);
    const stored = await this.storage.verifyObject(dto.objectKey);
    if (
      stored.sizeBytes !== dto.sizeBytes ||
      (stored.mimeType && stored.mimeType !== dto.mimeType)
    ) {
      throw new BadRequestException(
        'Uploaded object metadata does not match confirmation',
      );
    }
    const asset = await this.assetRepo.save(
      this.assetRepo.create({
        objectKey: dto.objectKey,
        url: this.storage.getPublicUrl(dto.objectKey),
        filename: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: String(dto.sizeBytes),
        uploadedByUserId: userId ?? null,
      }),
    );
    await this.audit.record(
      'mail_asset.uploaded',
      'email_asset',
      asset.id,
      userId,
      { filename: asset.filename, mimeType: asset.mimeType },
    );
    return asset;
  }

  list(): Promise<EmailAsset[]> {
    return this.assetRepo.find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  private validateFile(mimeType: string, size: number) {
    if (!ALLOWED_TYPES.has(mimeType))
      throw new BadRequestException('Unsupported file type');
    if (size > MAX_SIZE)
      throw new BadRequestException('File exceeds the 5 MB limit');
  }
}
