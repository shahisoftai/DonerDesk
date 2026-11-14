import type { LucideIcon } from "lucide-react";
import {
  Briefcase, Download, FileText, FolderKanban, Home, Inbox, Landmark, LayoutDashboard, Lock, Paperclip, Settings, ShieldCheck, Users,
} from "lucide-react";

/** One icon per sidebar address (Lucide, plan F77). An address not listed shows no icon. */
export const NAV_ICON: Readonly<Record<string, LucideIcon>> = {
  "/dashboard": Home,
  "/inbox": Inbox,
  "/projects": FolderKanban,
  "/visuals": LayoutDashboard,
  "/portfolio": Briefcase,
  "/reports": FileText,
  "/evidence": Paperclip,
  "/compliance": ShieldCheck,
  "/downloads": Download,
  "/programmes": Landmark,
  "/team": Users,
  "/settings": Settings,
  "/settings/security": Lock,
};
