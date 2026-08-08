import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AttendanceService } from './attendance.service';
import { AttendanceDay } from './entities/attendance-day.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { Child } from '../children/entities/child.entity';

describe('AttendanceService', () => {
  let dayRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    query: jest.Mock;
  };
  let recordRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
    insert: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let childRepo: { findOne: jest.Mock; find: jest.Mock };
  let service: AttendanceService;

  const date = '2026-08-08';

  // Built from local getters (not toISOString, which is UTC-based) to match
  // how the service itself computes "today" — see the toDateString comment
  // at the top of attendance.service.ts.
  function tomorrowDateString(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const year = tomorrow.getFullYear();
    const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const day = String(tomorrow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  beforeEach(() => {
    dayRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((d: unknown) =>
        Promise.resolve({ id: 'day-1', ...(d as object) }),
      ),
      create: jest.fn((d: unknown) => d),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([{ count: 0 }]),
    };
    recordRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((r: unknown) =>
        Promise.resolve({ id: 'record-1', ...(r as object) }),
      ),
      create: jest.fn((r: unknown) => r),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(),
    };
    childRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'child-1', name: 'Aline' }),
      find: jest.fn().mockResolvedValue([]),
    };

    service = new AttendanceService(
      dayRepo as unknown as Repository<AttendanceDay>,
      recordRepo as unknown as Repository<AttendanceRecord>,
      childRepo as unknown as Repository<Child>,
    );
  });

  describe('getDayDetail', () => {
    it('rejects a malformed date', async () => {
      await expect(service.getDayDetail('08-08-2026')).rejects.toThrow(
        /YYYY-MM-DD/,
      );
    });

    it('marks every active child pending when no day has been taken yet', async () => {
      childRepo.find.mockResolvedValue([
        { id: 'c1', name: 'Aline', kcfNumber: 'K1' },
        { id: 'c2', name: 'Bosco', kcfNumber: 'K2' },
      ]);

      const detail = await service.getDayDetail(date);

      expect(detail.presentCount).toBe(0);
      expect(detail.pendingCount).toBe(2);
      expect(detail.totalActive).toBe(2);
      expect(detail.roster.every((r) => r.status === 'pending')).toBe(true);
      expect(dayRepo.save).not.toHaveBeenCalled();
    });

    it('reflects each status and tallies the per-status counts', async () => {
      dayRepo.findOne.mockResolvedValue({
        id: 'day-1',
        label: null,
        notes: null,
      });
      childRepo.find.mockResolvedValue([
        { id: 'c1', name: 'Aline', kcfNumber: 'K1' },
        { id: 'c2', name: 'Bosco', kcfNumber: 'K2' },
        { id: 'c3', name: 'Chantal', kcfNumber: 'K3' },
        { id: 'c4', name: 'Didier', kcfNumber: 'K4' },
      ]);
      recordRepo.find.mockResolvedValue([
        { childId: 'c1', status: AttendanceStatus.PRESENT, note: null },
        { childId: 'c2', status: AttendanceStatus.LATE, note: null },
        {
          childId: 'c3',
          status: AttendanceStatus.ABSENT,
          note: 'Sick',
        },
        { childId: 'c4', status: AttendanceStatus.EXCUSED, note: null },
      ]);

      const detail = await service.getDayDetail(date);

      expect(detail.presentCount).toBe(1);
      expect(detail.lateCount).toBe(1);
      expect(detail.absentCount).toBe(1);
      expect(detail.excusedCount).toBe(1);
      expect(detail.pendingCount).toBe(0);
      expect(detail.roster.find((r) => r.childId === 'c1')?.status).toBe(
        AttendanceStatus.PRESENT,
      );
      expect(detail.roster.find((r) => r.childId === 'c3')?.note).toBe('Sick');
    });
  });

  describe('setStatus', () => {
    it('throws if the child does not exist', async () => {
      childRepo.findOne.mockResolvedValue(null);
      await expect(
        service.setStatus(
          date,
          'missing',
          AttendanceStatus.PRESENT,
          undefined,
          'user-1',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the day row on first mark, then the record', async () => {
      await service.setStatus(
        date,
        'child-1',
        AttendanceStatus.PRESENT,
        undefined,
        'user-1',
      );

      expect(dayRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ createdByUserId: 'user-1' }),
      );
      expect(recordRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          attendanceDayId: 'day-1',
          childId: 'child-1',
          status: AttendanceStatus.PRESENT,
          note: null,
          markedByUserId: 'user-1',
        }),
      );
    });

    it('changes an existing record to a new status instead of no-oping', async () => {
      dayRepo.findOne.mockResolvedValue({ id: 'day-1' });
      recordRepo.findOne.mockResolvedValue({
        id: 'existing-record',
        status: AttendanceStatus.PRESENT,
        note: null,
      });

      const result = await service.setStatus(
        date,
        'child-1',
        AttendanceStatus.LATE,
        undefined,
        'user-1',
      );

      expect(result).toEqual(
        expect.objectContaining({
          id: 'existing-record',
          status: AttendanceStatus.LATE,
        }),
      );
      expect(recordRepo.save).toHaveBeenCalled();
    });

    it('leaves an existing note untouched when note is not provided', async () => {
      dayRepo.findOne.mockResolvedValue({ id: 'day-1' });
      recordRepo.findOne.mockResolvedValue({
        id: 'existing-record',
        status: AttendanceStatus.PRESENT,
        note: 'Arrived with guardian',
      });

      const result = await service.setStatus(
        date,
        'child-1',
        AttendanceStatus.LATE,
        undefined,
        'user-1',
      );

      expect(result).toEqual(
        expect.objectContaining({ note: 'Arrived with guardian' }),
      );
    });

    it('overwrites the note when explicitly provided', async () => {
      dayRepo.findOne.mockResolvedValue({ id: 'day-1' });
      recordRepo.findOne.mockResolvedValue({
        id: 'existing-record',
        status: AttendanceStatus.PRESENT,
        note: 'Old note',
      });

      const result = await service.setStatus(
        date,
        'child-1',
        AttendanceStatus.EXCUSED,
        'Doctor appointment',
        'user-1',
      );

      expect(result).toEqual(
        expect.objectContaining({ note: 'Doctor appointment' }),
      );
    });

    it('rejects marking attendance for a future date', async () => {
      await expect(
        service.setStatus(
          tomorrowDateString(),
          'child-1',
          AttendanceStatus.PRESENT,
          undefined,
          'user-1',
        ),
      ).rejects.toThrow(/future date/);
      expect(dayRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('markRemainingPresent', () => {
    it('bulk-inserts present records only for children with no record yet', async () => {
      dayRepo.findOne.mockResolvedValue({ id: 'day-1' });
      childRepo.find.mockResolvedValue([
        { id: 'c1' },
        { id: 'c2' },
        { id: 'c3' },
      ]);
      recordRepo.find.mockResolvedValue([
        { childId: 'c1', status: AttendanceStatus.ABSENT },
      ]);

      const result = await service.markRemainingPresent(date, 'user-1');

      expect(result).toEqual({ marked: 2 });
      expect(recordRepo.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          childId: 'c2',
          status: AttendanceStatus.PRESENT,
        }),
        expect.objectContaining({
          childId: 'c3',
          status: AttendanceStatus.PRESENT,
        }),
      ]);
    });

    it('does nothing when everyone already has a record', async () => {
      dayRepo.findOne.mockResolvedValue({ id: 'day-1' });
      childRepo.find.mockResolvedValue([{ id: 'c1' }]);
      recordRepo.find.mockResolvedValue([
        { childId: 'c1', status: AttendanceStatus.PRESENT },
      ]);

      const result = await service.markRemainingPresent(date, 'user-1');

      expect(result).toEqual({ marked: 0 });
      expect(recordRepo.insert).not.toHaveBeenCalled();
    });

    it('rejects a future date', async () => {
      await expect(
        service.markRemainingPresent(tomorrowDateString(), 'user-1'),
      ).rejects.toThrow(/future date/);
    });
  });

  describe('resetDay', () => {
    it('no-ops when the day was never taken', async () => {
      const result = await service.resetDay(date);
      expect(result).toEqual({ success: true });
      expect(recordRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes every record for the day, keeping the day row', async () => {
      dayRepo.findOne.mockResolvedValue({ id: 'day-1' });
      await service.resetDay(date);
      expect(recordRepo.delete).toHaveBeenCalledWith({
        attendanceDayId: 'day-1',
      });
    });
  });

  describe('unmark', () => {
    it('no-ops when the day was never taken', async () => {
      const result = await service.unmark(date, 'child-1');
      expect(result).toEqual({ success: true });
      expect(recordRepo.delete).not.toHaveBeenCalled();
    });

    it('deletes the record when the day exists', async () => {
      dayRepo.findOne.mockResolvedValue({ id: 'day-1' });
      await service.unmark(date, 'child-1');
      expect(recordRepo.delete).toHaveBeenCalledWith({
        attendanceDayId: 'day-1',
        childId: 'child-1',
      });
    });
  });

  describe('updateDay', () => {
    it('get-or-creates the day row and applies the label/notes', async () => {
      const result = await service.updateDay(
        date,
        { label: 'Christmas Program' },
        'user-1',
      );
      expect(dayRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ label: 'Christmas Program' }),
      );
      expect(result).toEqual(
        expect.objectContaining({ label: 'Christmas Program' }),
      );
    });

    it('rejects labeling a future date', async () => {
      await expect(
        service.updateDay(tomorrowDateString(), { label: 'Nope' }, 'user-1'),
      ).rejects.toThrow(/future date/);
      expect(dayRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('future dates remain readable', () => {
    it('getDayDetail on a future date just shows everyone pending, no error', async () => {
      childRepo.find.mockResolvedValue([
        { id: 'c1', name: 'Aline', kcfNumber: 'K1' },
      ]);

      const detail = await service.getDayDetail(tomorrowDateString());

      expect(detail.presentCount).toBe(0);
      expect(detail.roster.every((r) => r.status === 'pending')).toBe(true);
    });

    it('unmark on a future date is still a harmless no-op', async () => {
      const result = await service.unmark(tomorrowDateString(), 'child-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('getChildHistory', () => {
    it('throws if the child does not exist', async () => {
      childRepo.findOne.mockResolvedValue(null);
      await expect(service.getChildHistory('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    // Regression test: node-pg's default date parser builds a Date from a
    // raw query's `date` column using LOCAL midnight, not UTC midnight — a
    // naive `.toISOString().slice(0, 10)` shifts the calendar date backward
    // by a day on any server whose local timezone is ahead of UTC.
    it('formats a raw-query date correctly regardless of the server timezone', async () => {
      const localMidnight = new Date(2000, 0, 1); // Jan 1 2000, local time
      const getRawMany = jest.fn().mockResolvedValue([
        {
          date: localMidnight,
          label: 'Special Day',
          status: AttendanceStatus.PRESENT,
          note: null,
        },
      ]);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany,
      };
      recordRepo.createQueryBuilder.mockReturnValue(qb);
      dayRepo.query.mockResolvedValue([{ count: 1 }]);

      const result = await service.getChildHistory('child-1');

      expect(result.records[0].date).toBe('2000-01-01');
    });

    it('computes the attendance rate from present/late records over total gathering days', async () => {
      const getRawMany = jest.fn().mockResolvedValue([
        {
          date: '2026-08-01',
          label: null,
          status: AttendanceStatus.PRESENT,
          note: null,
        },
        {
          date: '2026-07-25',
          label: null,
          status: AttendanceStatus.LATE,
          note: null,
        },
        {
          date: '2026-07-18',
          label: null,
          status: AttendanceStatus.ABSENT,
          note: 'Sick',
        },
      ]);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany,
      };
      recordRepo.createQueryBuilder.mockReturnValue(qb);
      dayRepo.query.mockResolvedValue([{ count: 4 }]);

      const result = await service.getChildHistory('child-1');

      expect(result.totalPresent).toBe(2);
      expect(result.attendanceRatePercent).toBe(50);
      expect(result.records[2].note).toBe('Sick');
    });
  });
});
