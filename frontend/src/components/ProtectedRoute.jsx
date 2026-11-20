import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute({
  user,
  loading,
  allowedRole,
  children
}) {
  if (loading) {
    return <div>Checking your SARATHI session...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    const path =
      user.role === "merchant"
        ? "/merchant/dashboard"
        : user.role === "delivery"
        ? "/delivery/dashboard"
        : "/customer/dashboard";

    return <Navigate to={path} replace />;
  }

  return children || <Outlet />;
}
