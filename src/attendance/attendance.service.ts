import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { AttendanceDay } from './entities/attendance-day.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { Child } from '../children/entities/child.entity';
import { ChildStatus } from '../children/enums/child.enums';
import { UpdateAttendanceDayDto } from './dto/update-attendance-day.dto';
import { QueryAttendanceDaysDto } from './dto/query-attendance-days.dto';
import {
  AttendanceDayDetail,
  buildAttendanceCsv,
  buildAttendancePdf,
} from './attendance-export.util';

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

// The rolling window used to compute a child's attendance rate — keeps the
// numerator (this child's present/late records) and denominator (total
// gathering days) over the same span, rather than mixing a capped numerator
// with an unbounded denominator (which would understate a long-tenured
// child's rate). This is a simple approximation, not adjusted for the
// child's enrolment date.
const HISTORY_WINDOW = 200;

// Postgres `date` columns come back from node-pg/TypeORM as either a Date
// object or an already-formatted string depending on the query path (a
// hydrated entity vs. a raw queryBuilder result). node-pg's default date
// parser builds that Date from the calendar date using LOCAL time (e.g.
// '2000-01-01' becomes local midnight, not UTC midnight) — so reading it
// back with the UTC-based toISOString() shifts the date backward by the
// server's UTC offset outside UTC. Pulling the calendar fields via the
// local getters instead of toISOString() avoids that shift.
function toDateString(value: Date | string): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// "Attended" for rate/history-count purposes means present or late — an
// excused absence or an unexcused absence both count against the rate, but
// arriving late still counts as showing up.
const ATTENDED_STATUSES = [AttendanceStatus.PRESENT, AttendanceStatus.LATE];

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceDay)
    private readonly dayRepo: Repository<AttendanceDay>,
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(Child)
    private readonly childRepo: Repository<Child>,
  ) {}

  private assertValidDate(date: string): void {
    if (!DATE_FORMAT.test(date)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }
  }

  private assertNotFuture(date: string): void {
    if (date > toDateString(new Date())) {
      throw new BadRequestException(
        'Cannot record attendance for a future date',
      );
    }
  }

  private findDayByDate(date: string): Promise<AttendanceDay | null> {
    return this.dayRepo.findOne({ where: { date: date as unknown as Date } });
  }

  private async getOrCreateDay(
    date: string,
    actorUserId: string | null,
  ): Promise<AttendanceDay> {
    const existing = await this.findDayByDate(date);
    if (existing) return existing;
    return this.dayRepo.save(
      this.dayRepo.create({
        date: date as unknown as Date,
        createdByUserId: actorUserId,
      }),
    );
  }

  async getDayDetail(date: string): Promise<AttendanceDayDetail> {
    this.assertValidDate(date);
    const [day, activeChildren] = await Promise.all([
      this.findDayByDate(date),
      this.childRepo.find({
        where: { status: ChildStatus.ACTIVE },
        order: { name: 'ASC' },
      }),
    ]);

    const recordsByChild = day
      ? new Map(
          (
            await this.recordRepo.find({ where: { attendanceDayId: day.id } })
          ).map((r) => [r.childId, r] as const),
        )
      : new Map<string, AttendanceRecord>();

    const counts: Record<AttendanceStatus | 'pending', number> = {
      [AttendanceStatus.PRESENT]: 0,
      [AttendanceStatus.LATE]: 0,
      [AttendanceStatus.ABSENT]: 0,
      [AttendanceStatus.EXCUSED]: 0,
      pending: 0,
    };

    const roster = activeChildren.map((child) => {
      const record = recordsByChild.get(child.id);
      const status: AttendanceStatus | 'pending' = record?.status ?? 'pending';
      counts[status] += 1;
      return {
        childId: child.id,
        name: child.name,
        kcfNumber: child.kcfNumber,
        imageUrl: child.imageUrl,
        status,
        note: record?.note ?? null,
      };
    });

    return {
      date,
      label: day?.label ?? null,
      notes: day?.notes ?? null,
      totalActive: activeChildren.length,
      presentCount: counts[AttendanceStatus.PRESENT],
      lateCount: counts[AttendanceStatus.LATE],
      absentCount: counts[AttendanceStatus.ABSENT],
      excusedCount: counts[AttendanceStatus.EXCUSED],
      pendingCount: counts.pending,
      roster,
    };
  }

  async setStatus(
    date: string,
    childId: string,
    status: AttendanceStatus,
    note: string | undefined,
    actorUserId: string | null,
  ): Promise<AttendanceRecord> {
    this.assertValidDate(date);
    this.assertNotFuture(date);
    const child = await this.childRepo.findOne({ where: { id: childId } });
    if (!child) throw new NotFoundException(`Child ${childId} not found`);

    const day = await this.getOrCreateDay(date, actorUserId);
    const existing = await this.recordRepo.findOne({
      where: { attendanceDayId: day.id, childId },
    });
    if (existing) {
      existing.status = status;
      // A note is only overwritten when explicitly provided, so clicking a
      // status button elsewhere (e.g. the roster table) never silently
      // wipes a note added from the side panel.
      if (note !== undefined) existing.note = note;
      existing.markedByUserId = actorUserId;
      return this.recordRepo.save(existing);
    }

    return this.recordRepo.save(
      this.recordRepo.create({
        attendanceDayId: day.id,
        childId,
        status,
        note: note ?? null,
        markedByUserId: actorUserId,
      }),
    );
  }

  async markRemainingPresent(
    date: string,
    actorUserId: string | null,
  ): Promise<{ marked: number }> {
    this.assertValidDate(date);
    this.assertNotFuture(date);
    const day = await this.getOrCreateDay(date, actorUserId);
    const [activeChildren, existingRecords] = await Promise.all([
      this.childRepo.find({
        where: { status: ChildStatus.ACTIVE },
        select: ['id'],
      }),
      this.recordRepo.find({ where: { attendanceDayId: day.id } }),
    ]);
    const alreadyMarked = new Set(existingRecords.map((r) => r.childId));
    const remaining = activeChildren.filter((c) => !alreadyMarked.has(c.id));
    if (remaining.length === 0) return { marked: 0 };

    await this.recordRepo.insert(
      remaining.map((c) => ({
        attendanceDayId: day.id,
        childId: c.id,
        status: AttendanceStatus.PRESENT,
        markedByUserId: actorUserId,
      })),
    );
    return { marked: remaining.length };
  }

  async resetDay(date: string): Promise<{ success: true }> {
    this.assertValidDate(date);
    const day = await this.findDayByDate(date);
    if (day) {
      await this.recordRepo.delete({ attendanceDayId: day.id });
    }
    return { success: true };
  }

  async unmark(date: string, childId: string): Promise<{ success: true }> {
    this.assertValidDate(date);
    const day = await this.findDayByDate(date);
    if (day) {
      await this.recordRepo.delete({ attendanceDayId: day.id, childId });
    }
    return { success: true };
  }

  async updateDay(
    date: string,
    dto: UpdateAttendanceDayDto,
    actorUserId: string | null,
  ): Promise<AttendanceDay> {
    this.assertValidDate(date);
    this.assertNotFuture(date);
    const day = await this.getOrCreateDay(date, actorUserId);
    Object.assign(day, dto);
    return this.dayRepo.save(day);
  }

  async listDays(query: QueryAttendanceDaysDto) {
    const where =
      query.from && query.to
        ? {
            date: Between(
              query.from as unknown as Date,
              query.to as unknown as Date,
            ),
          }
        : query.from
          ? { date: MoreThanOrEqual(query.from as unknown as Date) }
          : query.to
            ? { date: LessThanOrEqual(query.to as unknown as Date) }
            : {};
    const [days, total] = await this.dayRepo.findAndCount({
      where,
      order: { date: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    if (days.length === 0) {
      return {
        data: [],
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    }

    // Counts only present/late records — attendance_record rows can now
    // also represent an explicit Absent or Excused marking, which must not
    // inflate the "Present" column shown in the history list.
    const counts = await this.recordRepo
      .createQueryBuilder('r')
      .select('r.attendanceDayId', 'dayId')
      .addSelect('COUNT(*)', 'count')
      .where('r.attendanceDayId IN (:...dayIds)', {
        dayIds: days.map((d) => d.id),
      })
      .andWhere('r.status IN (:...statuses)', { statuses: ATTENDED_STATUSES })
      .groupBy('r.attendanceDayId')
      .getRawMany<{ dayId: string; count: string }>();
    const countByDay = new Map(counts.map((c) => [c.dayId, Number(c.count)]));

    return {
      data: days.map((day) => ({
        date: toDateString(day.date),
        label: day.label,
        presentCount: countByDay.get(day.id) ?? 0,
      })),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getChildHistory(childId: string): Promise<{
    attendanceRatePercent: number;
    totalPresent: number;
    records: {
      date: string;
      label: string | null;
      status: AttendanceStatus;
      note: string | null;
    }[];
  }> {
    const child = await this.childRepo.findOne({ where: { id: childId } });
    if (!child) throw new NotFoundException(`Child ${childId} not found`);

    const [rows, totalDaysRow] = await Promise.all([
      this.recordRepo
        .createQueryBuilder('r')
        .innerJoin(AttendanceDay, 'd', 'd.id = r."attendanceDayId"')
        .select('d.date', 'date')
        .addSelect('d.label', 'label')
        .addSelect('r.status', 'status')
        .addSelect('r.note', 'note')
        .where('r."childId" = :childId', { childId })
        .orderBy('d.date', 'DESC')
        .limit(HISTORY_WINDOW)
        .getRawMany<{
          date: string | Date;
          label: string | null;
          status: AttendanceStatus;
          note: string | null;
        }>(),
      this.dayRepo.query<{ count: number }[]>(
        `SELECT COUNT(*)::int AS count FROM (
           SELECT id FROM attendance_day ORDER BY date DESC LIMIT $1
         ) recent`,
        [HISTORY_WINDOW],
      ),
    ]);

    const totalPresent = rows.filter((r) =>
      (ATTENDED_STATUSES as string[]).includes(r.status),
    ).length;
    const totalDays: number = totalDaysRow[0]?.count ?? 0;

    return {
      attendanceRatePercent:
        totalDays === 0 ? 0 : Math.round((100 * totalPresent) / totalDays),
      totalPresent,
      records: rows.map((row) => ({
        date: toDateString(row.date),
        label: row.label,
        status: row.status,
        note: row.note,
      })),
    };
  }

  async exportCsv(date: string): Promise<string> {
    return buildAttendanceCsv(await this.getDayDetail(date));
  }

  async exportPdf(date: string): Promise<Buffer> {
    return buildAttendancePdf(await this.getDayDetail(date));
  }
}
