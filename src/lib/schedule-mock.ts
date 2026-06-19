import type { ScheduleEmployee } from "@/lib/schedule";
import {
  buildScheduleShiftFields,
  MOCK_SCHEDULE_PROFILE_NAME,
  parseDateKey,
  sortScheduleEmployeesByShiftStart,
} from "@/lib/schedule";

const MOCK_EMPLOYEE_NAMES = [
  "John Smith",
  "Jane Doe",
  "Alex Johnson",
  "Sarah Williams",
  "Michael Brown",
  "Emily Davis",
  "David Wilson",
  "Olivia Martinez",
] as const;

type MockShiftTemplate = {
  startHour: number;
  durationHours: number;
  shiftNotes: string;
};

const MOCK_SHIFT_TEMPLATES: MockShiftTemplate[] = [
  { startHour: 5.5, durationHours: 8, shiftNotes: "Opener" },
  { startHour: 6, durationHours: 8, shiftNotes: "Opener" },
  { startHour: 8, durationHours: 8, shiftNotes: "" },
  { startHour: 9, durationHours: 8, shiftNotes: "" },
  { startHour: 11, durationHours: 4, shiftNotes: "" },
  { startHour: 12, durationHours: 6, shiftNotes: "Training" },
  { startHour: 17, durationHours: 8, shiftNotes: "Closer" },
  { startHour: 18, durationHours: 4, shiftNotes: "" },
];

function mockEmployeeId(name: string): string {
  return `mock-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function profileUsesMockRoster(profileName: string): boolean {
  const normalized = profileName.trim().toLowerCase();
  const target = MOCK_SCHEDULE_PROFILE_NAME.trim().toLowerCase();
  return normalized === target || normalized.includes("manchester crenshaw");
}

function dateSeed(dateKey: string): number {
  return dateKey.split("-").reduce((sum, part) => sum + Number(part), 0);
}

export function mockScheduleEmployees(profileName: string, dateKey: string): ScheduleEmployee[] {
  if (!profileUsesMockRoster(profileName)) return [];
  const parsed = parseDateKey(dateKey);
  const isSunday = parsed?.getDay() === 0;
  const names = isSunday ? MOCK_EMPLOYEE_NAMES.slice(0, 4) : MOCK_EMPLOYEE_NAMES;
  const seed = dateSeed(dateKey);

  return sortScheduleEmployeesByShiftStart(
    names.map((name, index) => {
      const shift = MOCK_SHIFT_TEMPLATES[(index + seed) % MOCK_SHIFT_TEMPLATES.length];
      return {
        id: mockEmployeeId(name),
        name,
        ...buildScheduleShiftFields(shift.startHour, shift.durationHours, shift.shiftNotes),
      };
    }),
  );
}
