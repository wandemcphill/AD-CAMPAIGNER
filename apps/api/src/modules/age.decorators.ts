import { SetMetadata } from "@nestjs/common";

export const requireAdultKey = "fliptrybe:age:adult";

/**
 * Gates a route behind the 18+ age requirement. A caller whose user record has
 * no dateOfBirth, or a dateOfBirth under 18 years ago, gets 403 (see AgeGuard).
 *
 * Applied to financial products (virtual accounts/cards, remittance) and managed
 * ad campaign creation — the surfaces the route map marks "Authenticated (18+)".
 */
export const RequireAdult = () => SetMetadata(requireAdultKey, true);
