import { SetMetadata } from '@nestjs/common';
import { TriggerMetadata } from './mail-trigger.types';

export const MAIL_TRIGGER_METADATA = 'mail:trigger';

export const MailTrigger = (metadata: TriggerMetadata): ClassDecorator =>
  SetMetadata(MAIL_TRIGGER_METADATA, metadata);
