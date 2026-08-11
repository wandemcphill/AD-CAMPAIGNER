import { redirect } from "next/navigation";

export default function Page() {
  redirect("/os/settings/integrations?tab=keys");
}
