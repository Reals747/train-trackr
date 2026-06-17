/** Small XML helpers for HotSchedules SOAP requests and responses. */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function readTagInt(block: string, tag: string): number | undefined {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i").exec(block);
  if (!match) return undefined;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readTagString(block: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i").exec(block);
  return match ? match[1] : undefined;
}

export function readTagBool(block: string, tag: string): boolean | undefined {
  const value = readTagString(block, tag);
  if (value === undefined) return undefined;
  return value === "true" || value === "1";
}

export function readSimpleDate(block: string, tag: string): { day: number; month: number; year: number } | undefined {
  const section = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(block)?.[1];
  if (!section) return undefined;
  const day = readTagInt(section, "day");
  const month = readTagInt(section, "month");
  const year = readTagInt(section, "year");
  if (day === undefined || month === undefined || year === undefined) return undefined;
  return { day, month, year };
}

export function readSimpleTime(block: string, tag: string): {
  hours: number;
  minutes: number;
  seconds: number;
  militaryTime: boolean;
  amPm?: string;
} | undefined {
  const section = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i").exec(block)?.[1];
  if (!section) return undefined;
  const hours = readTagInt(section, "hours");
  const minutes = readTagInt(section, "minutes");
  if (hours === undefined || minutes === undefined) return undefined;
  return {
    hours,
    minutes,
    seconds: readTagInt(section, "seconds") ?? 0,
    militaryTime: readTagBool(section, "militaryTime") ?? true,
    amPm: readTagString(section, "amPm"),
  };
}

export function extractItemBlocks(xml: string): string[] {
  const blocks: string[] = [];
  const pattern = /<item>([\s\S]*?)<\/item>/gi;
  let match = pattern.exec(xml);
  while (match) {
    blocks.push(match[1]);
    match = pattern.exec(xml);
  }
  return blocks;
}

export function simpleDateXml(tag: string, date: { day: number; month: number; year: number }): string {
  return `<${tag}><day>${date.day}</day><month>${date.month}</month><year>${date.year}</year></${tag}>`;
}
