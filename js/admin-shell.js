// Shared boot for lightweight protected admin placeholder pages.
import { requireAdmin, mountAdminChrome } from "./admin-auth.js";

export function bootAdminPage() {
  if (!requireAdmin()) return false;
  mountAdminChrome();
  return true;
}
