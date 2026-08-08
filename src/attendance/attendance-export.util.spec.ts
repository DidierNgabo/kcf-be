import {
  buildAttendanceCsv,
  buildAttendancePdf,
} from './attendance-export.util';
import { AttendanceStatus } from './enums/attendance-status.enum';

const detail = {
  date: '2026-08-08',
  label: 'Christmas Program',
  notes: null,
  totalActive: 4,
  presentCount: 1,
  lateCount: 1,
  absentCount: 1,
  excusedCount: 0,
  pendingCount: 1,
  roster: [
    {
      childId: 'c1',
      name: 'Aline "The Great"',
      kcfNumber: 'K-001',
      imageUrl: null,
      status: AttendanceStatus.PRESENT,
      note: null,
    },
    {
      childId: 'c2',
      name: 'Bosco',
      kcfNumber: null,
      imageUrl: null,
      status: AttendanceStatus.LATE,
      note: 'Bus delayed',
    },
    {
      childId: 'c3',
      name: 'Chantal',
      kcfNumber: 'K-003',
      imageUrl: null,
      status: AttendanceStatus.ABSENT,
      note: null,
    },
    {
      childId: 'c4',
      name: 'Didier',
      kcfNumber: 'K-004',
      imageUrl: null,
      status: 'pending' as const,
      note: null,
    },
  ],
};

describe('buildAttendanceCsv', () => {
  it('produces a header row plus one row per roster entry, quoting values', () => {
    const csv = buildAttendanceCsv(detail);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Name","KCF Number","Status","Notes"');
    expect(lines[1]).toBe('"Aline ""The Great""","K-001","Present",""');
    expect(lines[2]).toBe('"Bosco","","Late","Bus delayed"');
    expect(lines[3]).toBe('"Chantal","K-003","Absent",""');
    expect(lines[4]).toBe('"Didier","K-004","Pending",""');
  });
});

describe('buildAttendancePdf', () => {
  it('produces a non-empty PDF buffer', async () => {
    const buffer = await buildAttendancePdf(detail);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
