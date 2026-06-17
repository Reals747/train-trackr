import type { HsEmployee, HsScheduleItem3, HsSimpleTime } from "@/lib/hotschedules/types";
import {
  computeShiftBreakSlots,
  formatScheduleHour,
  formatShiftDuration,
  formatShiftTimeFrame,
  type ScheduleEmployee,
} from "@/lib/schedule";

function hsTimeToHour24(time: HsSimpleTime): number {
  if (time.militaryTime) {
    return time.hours + time.minutes / 60;
  }
  const normalized = time.amPm?.toUpperCase() === "PM";
  let hour = time.hours % 12;
  if (normalized) hour += 12;
  return hour + time.minutes / 60;
}

function shiftDurationHours(shift: HsScheduleItem3): number {
  if (shift.regMinutes > 0) {
    return shift.regMinutes / 60;
  }
  if (shift.inDate && shift.inTime && shift.outDate && shift.outTime) {
    const start = new Date(
      shift.inDate.year,
      shift.inDate.month - 1,
      shift.inDate.day,
      ...timeParts(shift.inTime),
    );
    const end = new Date(
      shift.outDate.year,
      shift.outDate.month - 1,
      shift.outDate.day,
      ...timeParts(shift.outTime),
    );
    const minutes = (end.getTime() - start.getTime()) / 60_000;
    if (minutes > 0) return minutes / 60;
  }
  return 0;
}

function timeParts(time: HsSimpleTime): [number, number, number] {
  if (time.militaryTime) {
    return [time.hours, time.minutes, time.seconds ?? 0];
  }
  const isPm = time.amPm?.toUpperCase() === "PM";
  let hour = time.hours % 12;
  if (isPm) hour += 12;
  return [hour, time.minutes, time.seconds ?? 0];
}

function shiftTimeFrame(shift: HsScheduleItem3, durationHours: number): string {
  if (shift.inDate && shift.inTime && shift.outDate && shift.outTime) {
    const start = hsTimeToHour24(shift.inTime);
    const end = hsTimeToHour24(shift.outTime);
    if (shift.inDate.day === shift.outDate.day && end > start) {
      return `${formatScheduleHour(start)} - ${formatScheduleHour(end)}`;
    }
  }

  if (shift.inDate && shift.inTime && durationHours > 0) {
    const start = hsTimeToHour24(shift.inTime);
    return formatShiftTimeFrame(start, durationHours);
  }

  return "—";
}

function employeeName(shift: HsScheduleItem3, employeesByHsId: Map<number, HsEmployee>): string {
  const employee = employeesByHsId.get(shift.empHSId);
  if (employee) {
    const full = `${employee.firstName} ${employee.lastName}`.trim();
    if (full) return full;
  }
  if (shift.empPosId > 0) return `Employee #${shift.empPosId}`;
  return `Employee ${shift.empHSId}`;
}

function shiftId(shift: HsScheduleItem3): string {
  return `hs-${shift.empHSId}-${shift.scheduleId}-${shift.jobHsId}-${shift.inDate?.day ?? 0}`;
}

export function mapHotschedulesShiftsToScheduleEmployees(
  shifts: HsScheduleItem3[],
  employees: HsEmployee[],
): ScheduleEmployee[] {
  const employeesByHsId = new Map(employees.map((employee) => [employee.hsId, employee]));

  return shifts.map((shift) => {
    const durationHours = shiftDurationHours(shift);
    const durationLabel =
      durationHours > 0 ? formatShiftDuration(durationHours) : "—";
    const timeFrame = shiftTimeFrame(shift, durationHours);
    const breakSlots = durationHours > 0 ? computeShiftBreakSlots(durationHours) : {};

    return {
      id: shiftId(shift),
      name: employeeName(shift, employeesByHsId),
      shiftTimeFrame: timeFrame,
      shiftDuration: durationLabel,
      shiftNotes: shift.scheduleId > 0 ? `Schedule ${shift.scheduleId}` : "",
      ...breakSlots,
    };
  });
}
