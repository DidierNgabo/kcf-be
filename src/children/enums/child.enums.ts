export enum ChildStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

export enum ConsentType {
  GUARDIAN = 'guardian',
  PHOTO = 'photo',
}

export enum ConsentStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  PENDING = 'pending',
}

export enum MediaCategory {
  PROFILE = 'profile',
  DOCUMENT = 'document',
  PHOTO = 'photo',
  OTHER = 'other',
}

export enum ImportStatus {
  PREVIEWED = 'previewed',
  COMMITTING = 'committing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ImportAction {
  CREATE = 'create',
  UPDATE = 'update',
  UNCHANGED = 'unchanged',
  INVALID = 'invalid',
}
