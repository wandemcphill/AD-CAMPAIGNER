import { SetMetadata } from "@nestjs/common";

import type { Permission } from "@fliptrybe/types";

export const authorizationPublicKey = "fliptrybe:auth:public";
export const authorizationPermissionsKey = "fliptrybe:auth:permissions";

export const Public = () => SetMetadata(authorizationPublicKey, true);

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(authorizationPermissionsKey, permissions);
