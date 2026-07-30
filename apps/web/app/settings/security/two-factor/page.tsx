import { redirect } from "next/navigation";

export default function SettingsSecurityTwoFactorRedirectPage() {
  redirect("/os/settings/security/two-factor");
}
