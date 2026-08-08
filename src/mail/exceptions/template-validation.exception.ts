import { UnprocessableEntityException } from '@nestjs/common';
import { ValidationIssue } from '../rendering/validator';

export class TemplateValidationException extends UnprocessableEntityException {
  constructor(errors: ValidationIssue[], warnings: ValidationIssue[] = []) {
    super({
      statusCode: 422,
      valid: false,
      message: 'Template failed validation',
      errors,
      warnings,
    });
  }
}
