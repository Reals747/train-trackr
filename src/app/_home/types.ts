import type { RoleName } from "@/lib/permissions";

export type Role = RoleName;

/** Stored on data rows. */
export type DataProfile = "FOH" | "BOH";
/** Per-user view filter. Only FOH/BOH exist; the combined "BOTH" view was removed. */
export type ActiveProfile = DataProfile;

export type AppUser = {
  id: string;
  name: string;
  username: string;
  role: Role;
  storeName: string;
  storeCode: string;
  activeProfile: ActiveProfile;
};

/** "header" rows are non-clickable section dividers and never count toward completion. */
export type ChecklistKind = "item" | "header";

export type Position = {
  id: string;
  name: string;
  profile: DataProfile;
  hidden: boolean;
  order: number;
  items: { id: string; text: string; description: string | null; kind: ChecklistKind }[];
};

export type Trainee = {
  id: string;
  name: string;
  profile: DataProfile;
  startDate: string;
  positions: { positionId: string; position: { id: string; name: string } }[];
};

export type DashboardPositionDetail = {
  positionId: string;
  name: string;
  hidden: boolean;
  totalItems: number;
  completedItems: number;
  /** Derived from checklist: all done, none done, partial, or no checklist items (shown as "No items"). */
  status: "complete" | "partial" | "none" | "unavailable";
  items: { id: string; text: string; completed: boolean }[];
};

export type DashboardRow = {
  id: string;
  name: string;
  profile: DataProfile;
  percentage: number;
  positionsFullyComplete: number;
  storePositionCount: number;
  remainingPositions: number;
  positionDetails: DashboardPositionDetail[];
};

export type ActivityLog = { id: string; message: string; actor: string; createdAt: string };

export type AuthMode = "login" | "register-admin" | "register-trainer" | "set-password";

export type SettingsCategory =
  | "account"
  | "store"
  | "appearance"
  | "trainers"
  | "traineeManagement"
  | "trainingSetup";

export type AccountDetails = {
  id: string;
  name: string;
  username: string;
  role: Role;
  createdAt: string;
  storeName: string;
  storeId: string;
  storeCode: string;
};

export type StoreDetails = {
  id: string;
  name: string;
  storeCode: string;
  createdAt: string;
  _count: { users: number; positions: number; trainees: number };
};

export type TeamMember = {
  id: string;
  name: string;
  username: string;
  role: Role;
  createdAt: string;
  trainerInviteCodeUsed: string | null;
  hasPassword: boolean;
};

export type AppearanceSettings = {
  darkMode: boolean;
  fontScale: number;
  accent: string;
  compactCards: boolean;
  /** When true, theme follows OS/browser `prefers-color-scheme`; manual toggle is disabled. */
  followSystemTheme: boolean;
};

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  authorName: string;
  authorId: string;
  comments: {
    id: string;
    body: string;
    createdAt: string;
    userId: string;
    userName: string;
  }[];
};

export type ApiErrorBody = { error?: string; code?: string; storeName?: string };
export type ApiError = Error & { code?: string; storeName?: string };

export type LoginAs = "owner" | "trainer";

export type StoreCodeKickScope = "trainers_only" | "trainers_and_admins";
