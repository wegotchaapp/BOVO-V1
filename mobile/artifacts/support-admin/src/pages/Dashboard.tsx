import { useGetSupportDashboardOverview } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Inbox, Clock, CheckCircle2, AlertCircle, HelpCircle, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriorityBadge } from "../components/TicketBadges";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { data: overview, isLoading } = useGetSupportDashboardOverview();

  if (isLoading || !overview) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Open Tickets", value: overview.openCount, icon: AlertCircle, color: "text-red-500" },
    { label: "Pending", value: overview.pendingCount, icon: HelpCircle, color: "text-amber-500" },
    { label: "Unassigned", value: overview.unassignedCount, icon: Inbox, color: "text-gray-500" },
    { label: "Resolved Today", value: overview.resolvedTodayCount, icon: CheckCircle2, color: "text-green-500" },
  ];

  return (
    <div className="p-8 overflow-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mission Control</h1>
          <p className="text-muted-foreground mt-1">Real-time support operations overview</p>
        </div>
        <Link href="/inbox" className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" data-testid="link-inbox-shortcut">
          <Inbox className="mr-2 h-4 w-4" /> Go to Inbox
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(" ", "-")}`}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" /> Open Tickets by Priority
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-0 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={overview.byPriority} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <XAxis dataKey="priority" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4" /> Response Time
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center h-[300px] text-center">
            <div className="text-5xl font-bold tracking-tighter mb-2" data-testid="stat-avg-response">
              {overview.avgFirstResponseMinutes !== null ? overview.avgFirstResponseMinutes : "—"}
            </div>
            <p className="text-muted-foreground font-medium">Minutes</p>
            <p className="text-xs text-muted-foreground mt-4 max-w-[200px]">
              Average first response time for tickets created today.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
