import { Badge } from "@/components/ui/badge";
import { type TicketStatus, type TicketPriority, type RequesterRole } from "@workspace/api-client-react";

export function StatusBadge({ status }: { status: TicketStatus }) {
  switch (status) {
    case "open":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900 rounded-sm">OPEN</Badge>;
    case "pending":
      return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900 rounded-sm">PENDING</Badge>;
    case "resolved":
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-900 rounded-sm">RESOLVED</Badge>;
  }
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  switch (priority) {
    case "urgent":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">Urgent</span>;
    case "high":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">High</span>;
    case "normal":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Normal</span>;
    case "low":
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">Low</span>;
  }
}

export function RoleBadge({ role }: { role: RequesterRole }) {
  return (
    <Badge variant="secondary" className="text-[10px] uppercase tracking-wider py-0 px-1.5 h-4">
      {role}
    </Badge>
  );
}
