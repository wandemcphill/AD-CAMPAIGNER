import type { Permission, Role, TeamMember } from "@fliptrybe/types";

export const rolePermissions: Record<Role, Permission[]> = {
  OWNER: [
    "campaign:create",
    "campaign:approve",
    "campaign:manage",
    "payment:manage",
    "wallet:withdraw",
    "analytics:read",
    "team:manage",
    "admin:access",
    "support:manage",
    "audit:read"
  ],
  ADMIN: [
    "campaign:create",
    "campaign:approve",
    "campaign:manage",
    "payment:manage",
    "analytics:read",
    "team:manage",
    "admin:access",
    "support:manage",
    "audit:read"
  ],
  MANAGER: ["campaign:create", "campaign:manage", "analytics:read", "support:manage"],
  MARKETER: ["campaign:create", "campaign:manage", "analytics:read"],
  FINANCE: ["payment:manage", "wallet:withdraw", "analytics:read", "audit:read"],
  SUPPORT: ["support:manage", "analytics:read"],
  VIEWER: ["analytics:read"]
};

export function hasPermission(member: Pick<TeamMember, "role" | "permissions">, permission: Permission) {
  return rolePermissions[member.role].includes(permission) || member.permissions.includes(permission);
}

export function requirePermission(
  member: Pick<TeamMember, "role" | "permissions">,
  permission: Permission
) {
  if (!hasPermission(member, permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}
