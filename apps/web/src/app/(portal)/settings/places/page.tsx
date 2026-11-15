import { redirect } from "next/navigation";

/** Settings › Places moved (Phase 56): the organisation's places are managed under Where we work › Manage places. */
export default function SettingsPlacesRedirect() {
  redirect("/where-we-work/manage");
}
