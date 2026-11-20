
import { Link, useNavigate } from "react-router-dom";
import {
  Home,
  UserRound,
  ShieldCheck,
  LogOut,
  LayoutDashboard
} from "lucide-react";

export default function DashboardShell({
  user,
  onLogout,
  title,
  subtitle,
  children
}) {
  const navigate = useNavigate();

  const dashboardPath =
    user?.role === "merchant"
      ? "/merchant/dashboard"
      : user?.role === "delivery"
      ? "/delivery/dashboard"
      : "/customer/dashboard";

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    navigate("/");
  };

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <Link to="/" className="dashboard-brand">
          <ShieldCheck size={27} />
          <span>SARATHI</span>
        </Link>

        <div className="dashboard-user">
          <div className="dashboard-avatar">
            <UserRound size={24} />
          </div>

          <div>
            <h3>{user?.name || "User"}</h3>
            <p>{user?.role || "customer"}</p>
          </div>
        </div>

        <nav className="dashboard-nav">
          <Link to={dashboardPath} className="dashboard-nav-link active">
            <LayoutDashboard size={19} />
            Dashboard
          </Link>

          <Link to="/" className="dashboard-nav-link">
            <Home size={19} />
            Home
          </Link>
        </nav>

        <button
          type="button"
          className="dashboard-logout"
          onClick={handleLogout}
        >
          <LogOut size={19} />
          Logout
        </button>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <h1>{title || "Dashboard"}</h1>
            <p>{subtitle || "Welcome to your SARATHI dashboard."}</p>
          </div>
        </header>

        <section className="dashboard-content">
          {children}
        </section>
      </main>
    </div>
  );
}
