import rolesConfig from "@/config/roles.json";

/** Role names mirror the Prisma `Role` enum. Kept as strings so this module is safe on the client. */
export type RoleName = "OWNER" | "ADMIN" | "TRAINER" | "VIEWER";

export type Permission =
  | "settings.account"
  | "settings.appearance"
  | "settings.store.view"
  | "settings.store.rename"
  | "settings.store.delete"
  | "settings.trainingSetup"
  | "settings.trainers"
  | "members.view"
  | "members.invite"
  | "members.updateRole"
  | "members.remove"
  | "announcements.post"
  | "announcements.delete"
  | "announcements.comment"
  | "trainees.create"
  | "trainees.update"
  | "trainees.delete"
  | "workflow.edit"
  | "activity.view"
  | "positions.manage"
  | "checklistItems.manage";

type RoleConfig = {
  label: string;
  description: string;
  permissions: Permission[];
};

const CONFIG = rolesConfig as Record<RoleName, RoleConfig>;

export function can(role: RoleName | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  const cfg = CONFIG[role];
  if (!cfg) return false;
  return cfg.permissions.includes(permission);
}

export function roleLabel(role: RoleName): string {
  return CONFIG[role]?.label ?? role;
}

export function rolesWithPermission(permission: Permission): RoleName[] {
  return (Object.keys(CONFIG) as RoleName[]).filter((r) => CONFIG[r].permissions.includes(permission));
}
