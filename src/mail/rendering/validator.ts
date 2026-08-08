import { mailHandlebars, compileMailTemplate } from './handlebars.config';
import { ALLOWED_HELPER_NAMES } from './helpers';
import { TriggerDataField } from '../registry/mail-trigger.types';
import { GLOBAL_VARIABLE_NAMES } from './global-variables';
import { buildSampleContext } from './context-builder';

const BUILTIN_HELPERS = new Set([
  'if',
  'unless',
  'each',
  'with',
  'lookup',
  'log',
  'helperMissing',
  'blockHelperMissing',
]);
const ALLOWED_HELPERS = new Set<string>([
  ...ALLOWED_HELPER_NAMES,
  ...BUILTIN_HELPERS,
]);
const MAX_OUTPUT_SIZE_BYTES = 512 * 1024;

export type ValidationField = 'subject' | 'bodyHtml';

export interface ValidationIssue {
  field: ValidationField;
  line?: number;
  code: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) =>
      i === 0 ? j : j === 0 ? i : 0,
    ),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function closestMatch(name: string, candidates: string[]): string | undefined {
  let best: { name: string; distance: number } | undefined;
  for (const candidate of candidates) {
    const distance = levenshtein(name, candidate);
    if (!best || distance < best.distance) best = { name: candidate, distance };
  }
  return best && best.distance <= 3 ? best.name : undefined;
}

interface WalkContext {
  field: ValidationField;
  errors: ValidationIssue[];
  referencedPaths: Set<string>;
  allowedPaths: Set<string>;
}

function checkPath(
  path: hbs.AST.PathExpression,
  isCallee: boolean,
  ctx: WalkContext,
): void {
  if (path.data) return; // @index, @key, etc. — always fine
  const name = path.original;
  ctx.referencedPaths.add(name);

  if (isCallee) {
    if (!ALLOWED_HELPERS.has(name)) {
      ctx.errors.push({
        field: ctx.field,
        line: path.loc?.start.line,
        code: 'UNKNOWN_HELPER',
        message: `Helper '${name}' is not allowed. Allowed helpers: ${[...ALLOWED_HELPERS].join(', ')}.`,
      });
    }
    return;
  }

  if (name === 'this' || name === '.') return;

  const isAllowed =
    ctx.allowedPaths.has(name) ||
    [...ctx.allowedPaths].some(
      (p) => p.startsWith(`${name}.`) || name.startsWith(`${p}.`),
    );

  if (!isAllowed) {
    const suggestion = closestMatch(name, [...ctx.allowedPaths]);
    ctx.errors.push({
      field: ctx.field,
      line: path.loc?.start.line,
      code: 'UNKNOWN_VARIABLE',
      message: suggestion
        ? `'${name}' is not available. Did you mean '${suggestion}'?`
        : `'${name}' is not available.`,
    });
  }
}

function walkNode(node: hbs.AST.Node | undefined, ctx: WalkContext): void {
  if (!node) return;

  switch (node.type) {
    case 'Program': {
      const program = node as hbs.AST.Program;
      program.body.forEach((stmt) => walkNode(stmt, ctx));
      return;
    }
    case 'MustacheStatement': {
      const mustache = node as hbs.AST.MustacheStatement;
      if (mustache.escaped === false) {
        ctx.errors.push({
          field: ctx.field,
          line: mustache.loc?.start.line,
          code: 'RAW_HTML_NOT_ALLOWED',
          message:
            "Triple braces ('{{{ }}}') are not permitted in template content.",
        });
      }
      const isCall =
        mustache.params.length > 0 || (mustache.hash?.pairs.length ?? 0) > 0;
      if (mustache.path.type === 'PathExpression') {
        checkPath(mustache.path as hbs.AST.PathExpression, isCall, ctx);
      }
      mustache.params.forEach((p) => walkNode(p, ctx));
      mustache.hash?.pairs.forEach((pair) => walkNode(pair.value, ctx));
      return;
    }
    case 'BlockStatement': {
      const block = node as hbs.AST.BlockStatement;
      if (block.path.type === 'PathExpression') {
        checkPath(block.path, true, ctx);
      }
      block.params.forEach((p) => walkNode(p, ctx));
      block.hash?.pairs.forEach((pair) => walkNode(pair.value, ctx));
      walkNode(block.program, ctx);
      if (block.inverse) walkNode(block.inverse, ctx);
      return;
    }
    case 'SubExpression': {
      const sub = node as hbs.AST.SubExpression;
      if (sub.path.type === 'PathExpression') {
        checkPath(sub.path, true, ctx);
      }
      sub.params.forEach((p) => walkNode(p, ctx));
      sub.hash?.pairs.forEach((pair) => walkNode(pair.value, ctx));
      return;
    }
    case 'PathExpression': {
      checkPath(node as hbs.AST.PathExpression, false, ctx);
      return;
    }
    case 'PartialStatement':
    case 'PartialBlockStatement':
    case 'Decorator':
    case 'DecoratorBlock': {
      ctx.errors.push({
        field: ctx.field,
        line: node.loc?.start.line,
        code: 'UNSUPPORTED_CONSTRUCT',
        message: `'${node.type}' constructs are not permitted in template content.`,
      });
      return;
    }
    default:
      return; // ContentStatement, CommentStatement, literals — nothing to check
  }
}

function validateField(
  source: string,
  field: ValidationField,
  allowedPaths: Set<string>,
): { errors: ValidationIssue[]; referencedPaths: Set<string> } {
  const errors: ValidationIssue[] = [];
  const referencedPaths = new Set<string>();

  let ast: hbs.AST.Program;
  try {
    ast = mailHandlebars.parse(source);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Syntax error';
    const lineMatch = /line (\d+)/i.exec(message);
    errors.push({
      field,
      line: lineMatch ? Number(lineMatch[1]) : undefined,
      code: 'SYNTAX_ERROR',
      message,
    });
    return { errors, referencedPaths };
  }

  walkNode(ast, { field, errors, referencedPaths, allowedPaths });
  return { errors, referencedPaths };
}

export function validateTemplateSource(
  subject: string,
  bodyHtml: string,
  dataSchema: TriggerDataField[],
): ValidationResult {
  const allowedPaths = new Set<string>([
    ...GLOBAL_VARIABLE_NAMES,
    ...dataSchema.map((f) => f.name),
  ]);

  const subjectResult = validateField(subject, 'subject', allowedPaths);
  const bodyResult = validateField(bodyHtml, 'bodyHtml', allowedPaths);
  const errors = [...subjectResult.errors, ...bodyResult.errors];

  if (errors.length === 0) {
    try {
      const compiled = compileForSizeCheck(bodyHtml, dataSchema);
      if (Buffer.byteLength(compiled, 'utf8') > MAX_OUTPUT_SIZE_BYTES) {
        errors.push({
          field: 'bodyHtml',
          code: 'OUTPUT_TOO_LARGE',
          message: `Rendered output exceeds the ${MAX_OUTPUT_SIZE_BYTES / 1024}KB limit.`,
        });
      }
    } catch (err) {
      errors.push({
        field: 'bodyHtml',
        code: 'RENDER_ERROR',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to render with sample data',
      });
    }
  }

  const referenced = new Set([
    ...subjectResult.referencedPaths,
    ...bodyResult.referencedPaths,
  ]);
  const warnings: ValidationIssue[] = dataSchema
    .filter((f) => !referenced.has(f.name))
    .map((f) => ({
      field: 'bodyHtml',
      code: 'UNUSED_VARIABLE',
      message: `'${f.name}' is available but not used.`,
    }));

  return { valid: errors.length === 0, errors, warnings };
}

function compileForSizeCheck(
  bodyHtml: string,
  dataSchema: TriggerDataField[],
): string {
  const template = compileMailTemplate(bodyHtml);
  return template(buildSampleContext(dataSchema));
}
