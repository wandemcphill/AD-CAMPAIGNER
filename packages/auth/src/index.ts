import type { Permission, Role, TeamMember } from "@fliptrybe/types";

// "admin:access" is deliberately absent from every role's default permissions.
// It gates the platform admin console/API and must never be granted just by
// owning a workspace (every self-registered user is OWNER of their own new
// workspace) — see hasPermission below, which sources it solely from
// isPlatformAdmin on the user record, never from role defaults or the
// TeamMember.permissions array.
export const rolePermissions: Record<Role, Permission[]> = {
  OWNER: [
    "campaign:create",
    "campaign:approve",
    "campaign:manage",
    "payment:manage",
    "wallet:withdraw",
    "analytics:read",
    "team:manage",
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
    "support:manage",
    "audit:read"
  ],
  MANAGER: ["campaign:create", "campaign:manage", "analytics:read", "support:manage"],
  MARKETER: ["campaign:create", "campaign:manage", "analytics:read"],
  FINANCE: ["payment:manage", "wallet:withdraw", "analytics:read", "audit:read"],
  SUPPORT: ["support:manage", "analytics:read"],
  VIEWER: ["analytics:read"]
};

type PermissionCheckMember = Pick<TeamMember, "role" | "permissions"> & {
  isPlatformAdmin?: boolean;
};

export function hasPermission(member: PermissionCheckMember, permission: Permission) {
  if (permission === "admin:access") {
    return Boolean(member.isPlatformAdmin);
  }

  return rolePermissions[member.role].includes(permission) || member.permissions.includes(permission);
}

export function requirePermission(member: PermissionCheckMember, permission: Permission) {
  if (!hasPermission(member, permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}
