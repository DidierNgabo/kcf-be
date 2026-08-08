// "Pending" is intentionally not a member of this enum — it's the absence of
// an attendance_record row for a child on a given day, matching the same
// lazy-row philosophy already used for attendance_day itself (see
// getOrCreateDay in attendance.service.ts). A status is only ever stored
// once someone explicitly sets it.
export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
  EXCUSED = 'excused',
}
