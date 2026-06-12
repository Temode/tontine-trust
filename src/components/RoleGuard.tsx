import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { AppRole } from "@/integrations/supabase/client";

interface RoleGuardProps {
  allowedRoles: AppRole[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function RoleGuard({ allowedRoles, fallback = null, children }: RoleGuardProps) {
  const { roles, loading } = useAuth();
  if (loading) return null;
  const ok = allowedRoles.some((r) => roles.includes(r));
  return <>{ok ? children : fallback}</>;
}