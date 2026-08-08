import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { STORAGE_SERVICE } from '../storage/storage.types';
import type { StorageService } from '../storage/storage.types';
import {
  ConfirmMediaUploadDto,
  RequestMediaUploadDto,
  UpdateMediaDto,
} from './dto/media.dto';
import { ChildMedia } from './entities/child-media.entity';
import { Child } from './entities/child.entity';
import { MediaCategory } from './enums/child.enums';
import { AuditService } from '../audit/audit.service';
import { ConfigService } from '@nestjs/config';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_SIZE = 20 * 1024 * 1024;

@Injectable()
export class ChildMediaService {
  constructor(
    @InjectRepository(ChildMedia)
    private readonly mediaRepo: Repository<ChildMedia>,
    @InjectRepository(Child) private readonly childRepo: Repository<Child>,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async requestUpload(childId: string, dto: RequestMediaUploadDto) {
    await this.requireChild(childId);
    this.validateFile(dto.mimeType, dto.sizeBytes);
    const extension =
      dto.filename
        .split('.')
        .pop()
        ?.replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase() || 'bin';
    const objectKey = `children/${childId}/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`;
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
      expiresIn,
    };
  }

  async confirm(childId: string, dto: ConfirmMediaUploadDto, userId?: string) {
    const child = await this.requireChild(childId);
    if (!dto.objectKey.startsWith(`children/${childId}/`))
      throw new BadRequestException('Invalid object key');
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
    const media = await this.mediaRepo.save(
      this.mediaRepo.create({
        child,
        category: dto.category,
        objectKey: dto.objectKey,
        originalName: dto.filename,
        mimeType: dto.mimeType,
        sizeBytes: String(dto.sizeBytes),
        checksum: dto.checksum ?? null,
        caption: dto.caption ?? null,
        archivedAt: null,
      }),
    );
    if (dto.category === MediaCategory.PROFILE) {
      child.profileMediaId = media.id;
      await this.childRepo.save(child);
    }
    await this.audit.record('child.media.confirmed', 'child', childId, userId, {
      mediaId: media.id,
      category: media.category,
    });
    return media;
  }

  async accessUrl(childId: string, mediaId: string) {
    const media = await this.requireMedia(childId, mediaId);
    const expiresIn = this.config.get<number>('R2_SIGNED_URL_TTL_SECONDS', 300);
    return {
      url: await this.storage.createDownloadUrl(media.objectKey, expiresIn),
      expiresIn,
    };
  }

  async update(
    childId: string,
    mediaId: string,
    dto: UpdateMediaDto,
    userId?: string,
  ) {
    const media = await this.requireMedia(childId, mediaId);
    Object.assign(media, dto);
    const saved = await this.mediaRepo.save(media);
    await this.audit.record('child.media.updated', 'child', childId, userId, {
      mediaId,
    });
    return saved;
  }

  async archive(childId: string, mediaId: string, userId?: string) {
    const media = await this.requireMedia(childId, mediaId);
    media.archivedAt = new Date();
    await this.mediaRepo.save(media);
    await this.childRepo.update(
      { id: childId, profileMediaId: mediaId },
      { profileMediaId: null },
    );
    await this.audit.record('child.media.archived', 'child', childId, userId, {
      mediaId,
    });
    return { success: true };
  }

  private validateFile(mimeType: string, size: number) {
    if (!ALLOWED_TYPES.has(mimeType))
      throw new BadRequestException('Unsupported file type');
    if (size > MAX_SIZE)
      throw new BadRequestException('File exceeds the 20 MB limit');
  }
  private async requireChild(id: string) {
    const child = await this.childRepo.findOne({ where: { id } });
    if (!child) throw new NotFoundException('Child not found');
    return child;
  }
  private async requireMedia(childId: string, id: string) {
    const media = await this.mediaRepo.findOne({
      where: { id, child: { id: childId }, archivedAt: IsNull() },
      relations: { child: true },
    });
    if (!media) throw new NotFoundException('Media not found');
    return media;
  }
}
