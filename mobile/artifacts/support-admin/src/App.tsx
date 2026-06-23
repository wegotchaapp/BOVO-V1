import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AppShell } from "./components/AppShell";
import NotFound from "@/pages/not-found";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import TicketDetail from "./pages/TicketDetail";
import Agents from "./pages/Agents";
import { useEffect } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { agent, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !agent) {
      setLocation("/login");
    }
  }, [agent, isLoading, setLocation]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading session...</div>;
  }

  if (!agent) {
    return null;
  }

  return (
    <AppShell>
      <Component />
    </AppShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">{(params) => <ProtectedRoute component={Dashboard} />}</Route>
      <Route path="/inbox">{(params) => <ProtectedRoute component={Inbox} />}</Route>
      <Route path="/tickets/:id">{(params) => <ProtectedRoute component={TicketDetail} />}</Route>
      <Route path="/agents">{(params) => <ProtectedRoute component={Agents} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
