import PDFDocument from 'pdfkit';
import { AttendanceStatus } from './enums/attendance-status.enum';

export interface AttendanceRosterEntry {
  childId: string;
  name: string;
  kcfNumber: string | null;
  imageUrl: string | null;
  status: AttendanceStatus | 'pending';
  note: string | null;
}

export interface AttendanceDayDetail {
  date: string;
  label: string | null;
  notes: string | null;
  totalActive: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  excusedCount: number;
  pendingCount: number;
  roster: AttendanceRosterEntry[];
}

const STATUS_LABELS: Record<AttendanceStatus | 'pending', string> = {
  [AttendanceStatus.PRESENT]: 'Present',
  [AttendanceStatus.LATE]: 'Late',
  [AttendanceStatus.ABSENT]: 'Absent',
  [AttendanceStatus.EXCUSED]: 'Excused',
  pending: 'Pending',
};

// Mirrors the frontend's STATUS_META hex palette (attendance-status.ts) so
// the exported register reads the same as the on-screen roster.
const STATUS_COLORS: Record<AttendanceStatus | 'pending', string> = {
  [AttendanceStatus.PRESENT]: '#059669',
  [AttendanceStatus.LATE]: '#d97706',
  [AttendanceStatus.ABSENT]: '#dc2626',
  [AttendanceStatus.EXCUSED]: '#2563eb',
  pending: '#6b7280',
};

// Mirrors the quoting used by ChildImportService#errorReport for consistency
// across the app's only other CSV export.
function quote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function buildAttendanceCsv(detail: AttendanceDayDetail): string {
  const lines = [
    ['Name', 'KCF Number', 'Status', 'Notes'].map(quote).join(','),
    ...detail.roster.map((entry) =>
      [
        entry.name,
        entry.kcfNumber ?? '',
        STATUS_LABELS[entry.status],
        entry.note ?? '',
      ]
        .map(quote)
        .join(','),
    ),
  ];
  return lines.join('\n');
}

const MARGIN = 40;
// Each column gets its own fixed x/width and is drawn with an independent,
// non-continued .text() call — pdfkit's `continued: true` advances the
// cursor to wherever the previous call's text actually ended (not to the
// column's nominal width), so chaining continued calls for a table produces
// ragged columns that drift with every row's text length. Explicit,
// non-continued positioning per cell is what keeps columns aligned.
const COLUMNS = {
  name: { x: MARGIN, width: 250 },
  kcf: { x: MARGIN + 260, width: 90 },
  status: { x: MARGIN + 360, width: 100 },
} as const;
const ROW_HEIGHT = 22;
const HEADER_BG = '#f3f4f6';
const ZEBRA_BG = '#fafafa';
const BORDER = '#e5e7eb';

export function buildAttendancePdf(
  detail: AttendanceDayDetail,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err: Error) => reject(err));

    const pageRight = doc.page.width - MARGIN;

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .fillColor('#000')
      .text('Attendance Register', { align: 'center' });
    doc.moveDown(0.3);
    doc
      .fontSize(12)
      .font('Helvetica')
      .text(detail.label ? `${detail.date} — ${detail.label}` : detail.date, {
        align: 'center',
      });
    doc
      .fontSize(10)
      .fillColor('#666')
      .text(
        `${detail.presentCount} present · ${detail.lateCount} late · ${detail.absentCount} absent · ${detail.excusedCount} excused · ${detail.pendingCount} pending — ${detail.totalActive} total`,
        { align: 'center' },
      );
    if (detail.notes) {
      doc.moveDown(0.3);
      doc.fontSize(9).fillColor('#888').text(detail.notes, { align: 'center' });
    }
    doc.fillColor('#000');
    doc.moveDown(1.2);

    function drawHeaderRow(): void {
      const y = doc.y;
      doc.rect(MARGIN, y, pageRight - MARGIN, ROW_HEIGHT).fill(HEADER_BG);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000');
      doc.text('Name', COLUMNS.name.x + 8, y + 6, {
        width: COLUMNS.name.width - 8,
        lineBreak: false,
      });
      doc.text('KCF Number', COLUMNS.kcf.x, y + 6, {
        width: COLUMNS.kcf.width,
        lineBreak: false,
      });
      doc.text('Status', COLUMNS.status.x, y + 6, {
        width: COLUMNS.status.width,
        lineBreak: false,
      });
      doc.y = y + ROW_HEIGHT;
      doc
        .moveTo(MARGIN, doc.y)
        .lineTo(pageRight, doc.y)
        .strokeColor(BORDER)
        .stroke();
    }

    function ensureSpaceForRow(): void {
      const bottom = doc.page.height - MARGIN;
      if (doc.y + ROW_HEIGHT > bottom) {
        doc.addPage();
        doc.y = MARGIN;
        drawHeaderRow();
      }
    }

    drawHeaderRow();
    detail.roster.forEach((entry, index) => {
      ensureSpaceForRow();
      const y = doc.y;

      if (index % 2 === 1) {
        doc.rect(MARGIN, y, pageRight - MARGIN, ROW_HEIGHT).fill(ZEBRA_BG);
      }

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(entry.status === 'pending' ? '#9ca3af' : '#111827');
      doc.text(entry.name, COLUMNS.name.x + 8, y + 6, {
        width: COLUMNS.name.width - 8,
        lineBreak: false,
        ellipsis: true,
      });
      doc.text(entry.kcfNumber ?? '—', COLUMNS.kcf.x, y + 6, {
        width: COLUMNS.kcf.width,
        lineBreak: false,
        ellipsis: true,
      });

      doc
        .font('Helvetica-Bold')
        .fillColor(STATUS_COLORS[entry.status])
        .text(STATUS_LABELS[entry.status], COLUMNS.status.x, y + 6, {
          width: COLUMNS.status.width,
          lineBreak: false,
        });

      doc
        .moveTo(MARGIN, y + ROW_HEIGHT)
        .lineTo(pageRight, y + ROW_HEIGHT)
        .strokeColor(BORDER)
        .stroke();
      doc.y = y + ROW_HEIGHT;
    });

    doc.end();
  });
}
