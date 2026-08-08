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
}
