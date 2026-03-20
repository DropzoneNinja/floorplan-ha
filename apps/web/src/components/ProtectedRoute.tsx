import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.ts";

interface Props {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

/**
 * Wraps a route to require authentication.
 * If requireAdmin=true, also requires the admin role.
 */
export function ProtectedRoute({ children, requireAdmin }: Props) {
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requireAdmin && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
