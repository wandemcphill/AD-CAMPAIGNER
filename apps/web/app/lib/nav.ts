import type { ComponentProps } from "react";
import type Link from "next/link";

/**
 * next.config sets `typedRoutes: true`, so Link's `href` prop is a generated
 * union of real routes (plus template-literal patterns for dynamic segments)
 * rather than plain `string`. Any href built at runtime -- from a lookup
 * table, an API response, a template literal over an id -- has type `string`
 * and needs a cast to satisfy that union.
 *
 * Deriving the type from `Link` itself, rather than importing Next's `Route`
 * export directly, means this keeps working if Next renames or re-shapes
 * that type.
 *
 * This does not check the string is a real route -- a typo would still slip
 * through. It exists to satisfy the type system for hrefs that are correct
 * but not statically knowable, not to add runtime validation.
 */
type LinkHref = ComponentProps<typeof Link>["href"];

export const asHref = (href: string) => href as LinkHref;
