/** Fourth Schedules REST API types (see developer.fourth.com Schedules API guide). */

export type FourthShift = {
  locationTnAId: string;
  fourthAccountId: string;
  workDate: string;
  startDateTime: string;
  endDateTime: string;
  breakMinutes: number;
  roleName: string;
  locationName: string;
  departmentName: string;
};

export type FourthSchedulesCredentials = {
  apiRootUrl: string;
  username: string;
  password: string;
};

export type FourthSchedulesConfigResult =
  | { mode: "disabled" }
  | { mode: "misconfigured"; missing: string[] }
  | { mode: "ready"; credentials: FourthSchedulesCredentials };

/** @deprecated Use FourthSchedulesConfigResult */
export type HotschedulesConfigResult = FourthSchedulesConfigResult;

/** @deprecated Use FourthSchedulesCredentials */
export type HotschedulesCredentials = FourthSchedulesCredentials;
