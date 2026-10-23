import { useLocation } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import type { ReactNode } from "react";

/**
 * Frontière d'erreur scopée à une route : se réinitialise automatiquement
 * quand l'URL change, pour qu'une erreur figée n'empêche pas de naviguer ailleurs.
 */
export function RouteBoundary({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary
      fallbackTitle={`L'écran « ${name} » a rencontré un problème`}
      resetKey={pathname}
      boundaryName={name}
    >
      {children}
    </ErrorBoundary>
  );
}