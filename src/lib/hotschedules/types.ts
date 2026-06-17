/** HotSchedules SOAP types (ScheduleService / EmpService v3). */

export type HsSimpleDate = {
  day: number;
  month: number;
  year: number;
};

export type HsSimpleTime = {
  hours: number;
  minutes: number;
  seconds?: number;
  militaryTime: boolean;
  amPm?: string;
};

export type HsScheduleItem3 = {
  empHSId: number;
  empPosId: number;
  jobHsId: number;
  jobPosId: number;
  scheduleId: number;
  locationId: number;
  regMinutes: number;
  inDate?: HsSimpleDate;
  inTime?: HsSimpleTime;
  outDate?: HsSimpleDate;
  outTime?: HsSimpleTime;
};

export type HsEmployee = {
  hsId: number;
  empNum: number;
  firstName: string;
  lastName: string;
};

export type HotschedulesCredentials = {
  username: string;
  password: string;
  concept: number;
  storeNum: number;
};

export type HotschedulesConfigResult =
  | { mode: "disabled" }
  | { mode: "misconfigured"; missing: string[] }
  | { mode: "ready"; credentials: HotschedulesCredentials };
