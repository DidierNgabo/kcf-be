import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService, UploadRequest } from './storage.types';

@Injectable()
export class R2StorageService implements StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly publicBaseUrl: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('R2_BUCKET_NAME', '');
    this.endpoint = config.get<string>('R2_ENDPOINT', '');
    this.accessKeyId = config.get<string>('R2_ACCESS_KEY_ID', '');
    this.secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY', '');
    this.publicBaseUrl = config.get<string>('STORAGE_PUBLIC_BASE_URL', '');
    this.client = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  private assertConfigured() {
    const missing = [
      !this.endpoint && 'R2_ENDPOINT',
      !this.bucket && 'R2_BUCKET_NAME',
      !this.accessKeyId && 'R2_ACCESS_KEY_ID',
      !this.secretAccessKey && 'R2_SECRET_ACCESS_KEY',
    ].filter(Boolean);
    if (missing.length) {
      throw new ServiceUnavailableException(
        `R2 storage is not configured: missing ${missing.join(', ')}`,
      );
    }

    let endpoint: URL;
    try {
      endpoint = new URL(this.endpoint);
    } catch {
      throw new ServiceUnavailableException('R2_ENDPOINT is not a valid URL');
    }
    if (!endpoint.hostname.endsWith('.r2.cloudflarestorage.com')) {
      throw new ServiceUnavailableException(
        'R2_ENDPOINT must use the Cloudflare R2 S3 API endpoint, not an r2.dev public URL',
      );
    }
  }

  async createUploadUrl(request: UploadRequest) {
    this.assertConfigured();
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: request.objectKey,
        ContentType: request.mimeType,
        ...(request.checksum ? { ChecksumSHA256: request.checksum } : {}),
      }),
      { expiresIn: request.expiresIn },
    );
  }

  async createDownloadUrl(objectKey: string, expiresIn: number) {
    this.assertConfigured();
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }),
      { expiresIn },
    );
  }

  async verifyObject(objectKey: string) {
    this.assertConfigured();
    const result = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: objectKey }),
    );
    return {
      sizeBytes: result.ContentLength ?? 0,
      mimeType: result.ContentType,
    };
  }

  async copyObject(sourceKey: string, destinationKey: string): Promise<void> {
    this.assertConfigured();
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${encodeURIComponent(sourceKey)}`,
        Key: destinationKey,
      }),
    );
  }

  getPublicUrl(objectKey: string): string {
    return `${this.publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
  }
}
