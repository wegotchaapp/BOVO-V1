import { Link, useLocation } from "wouter";
import { LayoutDashboard, Inbox, Users, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSupportLogout } from "@workspace/api-client-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { agent, setAgent } = useAuth();
  const [location] = useLocation();
  const logout = useSupportLogout();

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setAgent(null);
      },
    });
  };

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/agents", label: "Agents", icon: Users },
  ];

  return (
    <div className="flex h-screen bg-background">
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b">
          <div className="font-bold text-lg text-primary flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary text-primary-foreground flex items-center justify-center text-xs">S</div>
            Bovogo Support
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-accent/20 text-accent font-semibold flex items-center justify-center text-sm">
              {agent?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{agent?.name}</div>
              <div className="text-xs text-muted-foreground truncate">{agent?.email}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left rounded-md hover:bg-muted">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
