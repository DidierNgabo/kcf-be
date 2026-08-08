import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateChildDto } from './create-child.dto';

export class UpdateChildDto extends PartialType(
  OmitType(CreateChildDto, ['kcfNumber'] as const),
) {}
