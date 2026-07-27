import { canAccessModule } from "@/lib/module-permissions";
import type { User } from "@/types";

export function homePathForUser(user: Partial<User> | null | undefined): string {
  if (!user) return "/dashboard";
  const perms = user.modulePermissions;
  if (user.role === "CASHIER") return "/pos";
  if (user.role === "WAITER") return "/resto";
  if (user.role === "KITCHEN") return "/resto/kitchen";
  if (user.role === "RESTO_MANAGER") return "/resto";
  if (canAccessModule(perms, "dashboard", "view")) return "/dashboard";
  if (canAccessModule(perms, "posSales", "view")) return "/pos";
  if (canAccessModule(perms, "floor", "view")) return "/resto";
  return "/dashboard";
}
