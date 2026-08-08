import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';

export const CHILD_IMPORT_PARSER = Symbol('CHILD_IMPORT_PARSER');
export type CsvRecord = Record<string, string>;
export interface ChildImportParser {
  parse(buffer: Buffer): CsvRecord[];
}

@Injectable()
export class StandardCsvParser implements ChildImportParser {
  parse(buffer: Buffer): CsvRecord[] {
    return parse(buffer, { columns: true, skip_empty_lines: true, bom: true, trim: true }) as CsvRecord[];
  }
}
