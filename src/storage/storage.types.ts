export const STORAGE_SERVICE = Symbol('STORAGE_SERVICE');

export interface UploadRequest {
  objectKey: string;
  mimeType: string;
  checksum?: string;
  expiresIn: number;
}

export interface StorageService {
  createUploadUrl(request: UploadRequest): Promise<string>;
  createDownloadUrl(objectKey: string, expiresIn: number): Promise<string>;
  verifyObject(objectKey: string): Promise<{ sizeBytes: number; mimeType?: string }>;
  // Server-side copy within the same bucket — used to promote an otherwise
  // private object (e.g. a child's profile photo) to a deliberately public
  // key prefix, without ever pulling the bytes through our own server.
  copyObject(sourceKey: string, destinationKey: string): Promise<void>;
  // Builds a permanent public URL for an object under the bucket's public
  // base URL (STORAGE_PUBLIC_BASE_URL) — only meaningful for keys under a
  // prefix that's actually configured as public (e.g. `email-assets/`).
  getPublicUrl(objectKey: string): string;
}
