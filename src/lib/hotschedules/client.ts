import type {
  HotschedulesCredentials,
  HsEmployee,
  HsScheduleItem3,
  HsSimpleDate,
} from "@/lib/hotschedules/types";
import {
  escapeXml,
  extractItemBlocks,
  readSimpleDate,
  readSimpleTime,
  readTagInt,
  readTagString,
  simpleDateXml,
} from "@/lib/hotschedules/xml";
import { parseDateKey } from "@/lib/schedule";

const SCHEDULE_SERVICE_URL = "https://services.hotschedules.com/api/services/ScheduleService";
const EMP_SERVICE_URL = "https://services.hotschedules.com/api/services/EmpService";

const WSSE_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
const PASSWORD_TYPE =
  "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText";

function buildSecurityHeader(credentials: HotschedulesCredentials): string {
  return `<wsse:Security xmlns:wsse="${WSSE_NS}" soapenv:mustUnderstand="1">
  <wsse:UsernameToken>
    <wsse:Username>${escapeXml(credentials.username)}</wsse:Username>
    <wsse:Password Type="${PASSWORD_TYPE}">${escapeXml(credentials.password)}</wsse:Password>
  </wsse:UsernameToken>
</wsse:Security>`;
}

function buildEnvelope(serviceNs: string, servicePrefix: string, body: string, credentials: HotschedulesCredentials): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:${servicePrefix}="${serviceNs}">
  <soapenv:Header>
    ${buildSecurityHeader(credentials)}
  </soapenv:Header>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function postSoap(url: string, envelope: string, action: string): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: action,
    },
    body: envelope,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HotSchedules HTTP ${response.status}: ${text.slice(0, 300)}`);
  }

  if (/<(?:[\w:]+:)?Fault[\s>]/i.test(text)) {
    const reason =
      readTagString(text, "faultstring") ??
      readTagString(text, "Reason") ??
      "HotSchedules SOAP fault";
    throw new Error(reason);
  }

  return text;
}

function dateKeyToHsSimpleDate(dateKey: string): HsSimpleDate {
  const parsed = parseDateKey(dateKey);
  if (!parsed) throw new Error(`Invalid date key: ${dateKey}`);
  return {
    day: parsed.getDate(),
    month: parsed.getMonth() + 1,
    year: parsed.getFullYear(),
  };
}

function parseScheduleItem(block: string): HsScheduleItem3 | null {
  const empHSId = readTagInt(block, "empHSId") ?? readTagInt(block, "empHsId");
  const empPosId = readTagInt(block, "empPosId");
  if (empHSId === undefined || empPosId === undefined) return null;

  return {
    empHSId,
    empPosId,
    jobHsId: readTagInt(block, "jobHsId") ?? -1,
    jobPosId: readTagInt(block, "jobPosId") ?? -1,
    scheduleId: readTagInt(block, "scheduleId") ?? -1,
    locationId: readTagInt(block, "locationId") ?? -1,
    regMinutes: readTagInt(block, "regMinutes") ?? 0,
    inDate: readSimpleDate(block, "inDate"),
    inTime: readSimpleTime(block, "inTime"),
    outDate: readSimpleDate(block, "outDate"),
    outTime: readSimpleTime(block, "outTime"),
  };
}

function parseEmployee(block: string): HsEmployee | null {
  const hsId = readTagInt(block, "hsId");
  if (hsId === undefined) return null;
  const firstName = readTagString(block, "FName")?.trim() ?? "";
  const lastName = readTagString(block, "LName")?.trim() ?? "";
  return {
    hsId,
    empNum: readTagInt(block, "empNum") ?? -1,
    firstName,
    lastName,
  };
}

/** Fetch posted/scheduled shifts for a single calendar day. */
export async function fetchHotschedulesShiftsForDay(
  credentials: HotschedulesCredentials,
  dateKey: string,
): Promise<HsScheduleItem3[]> {
  const hsDate = dateKeyToHsSimpleDate(dateKey);
  const body = `<sch:getShiftsV3>
  <concept>${credentials.concept}</concept>
  <storeNum>${credentials.storeNum}</storeNum>
  ${simpleDateXml("start", hsDate)}
  ${simpleDateXml("end", hsDate)}
  <isHouse>false</isHouse>
  <isScheduled>true</isScheduled>
  <isPosted>true</isPosted>
  <jobCodes></jobCodes>
</sch:getShiftsV3>`;

  const envelope = buildEnvelope(
    "http://services.hotschedules.com/api/services/ScheduleService",
    "sch",
    body,
    credentials,
  );

  const xml = await postSoap(SCHEDULE_SERVICE_URL, envelope, "getShiftsV3");
  return extractItemBlocks(xml)
    .map(parseScheduleItem)
    .filter((item): item is HsScheduleItem3 => item !== null);
}

/** Fetch active store employees for name resolution. */
export async function fetchHotschedulesStoreEmployees(
  credentials: HotschedulesCredentials,
): Promise<HsEmployee[]> {
  const body = `<emp:getStoreEmployees>
  <concept>${credentials.concept}</concept>
  <storeNum>${credentials.storeNum}</storeNum>
  <activeOnly>true</activeOnly>
</emp:getStoreEmployees>`;

  const envelope = buildEnvelope(
    "http://services.hotschedules.com/api/services/EmpService",
    "emp",
    body,
    credentials,
  );

  const xml = await postSoap(EMP_SERVICE_URL, envelope, "getStoreEmployees");
  return extractItemBlocks(xml)
    .map(parseEmployee)
    .filter((employee): employee is HsEmployee => employee !== null);
}
