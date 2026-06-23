import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Search, Filter, RefreshCw, Car, ArrowDownAZ, Loader2 } from "lucide-react";
import {
  listSupportTickets,
  ListSupportTicketsSort,
  type ListSupportTicketsParams,
  type SupportTicketSummary,
  type TicketStatus,
  type TicketPriority,
} from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PriorityBadge, StatusBadge, RoleBadge } from "../components/TicketBadges";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

const PAGE_SIZE = 25;

export default function Inbox() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [priority, setPriority] = useState<TicketPriority | "all">("all");
  const [sort, setSort] = useState<ListSupportTicketsSort>(
    ListSupportTicketsSort.updated_desc,
  );

  const baseParams: ListSupportTicketsParams = useMemo(
    () => ({
      ...(status !== "all" && { status }),
      ...(priority !== "all" && { priority }),
      ...(search && { search }),
      sort,
      limit: PAGE_SIZE,
    }),
    [status, priority, search, sort],
  );

  const queryKey = ["support-tickets-infinite", baseParams] as const;

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 0, signal }) =>
      listSupportTickets(
        { ...baseParams, offset: pageParam as number },
        { signal },
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    placeholderData: (prev) => prev,
  });

  const tickets: SupportTicketSummary[] =
    data?.pages.flat() ?? [];

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-card p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center shrink-0">
        <div>
          <h1 className="text-xl font-bold">Ticket Inbox</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subject or requester..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search"
            />
          </div>
          <Select
            value={status}
            onValueChange={(val) => setStatus(val as TicketStatus | "all")}
          >
            <SelectTrigger className="w-[140px] h-9" data-testid="select-status">
              <Filter className="w-3.5 h-3.5 mr-2 opacity-50" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={priority}
            onValueChange={(val) => setPriority(val as TicketPriority | "all")}
          >
            <SelectTrigger className="w-[140px] h-9" data-testid="select-priority">
              <Filter className="w-3.5 h-3.5 mr-2 opacity-50" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sort}
            onValueChange={(val) => setSort(val as ListSupportTicketsSort)}
          >
            <SelectTrigger className="w-[180px] h-9" data-testid="select-sort">
              <ArrowDownAZ className="w-3.5 h-3.5 mr-2 opacity-50" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ListSupportTicketsSort.updated_desc}>
                Newest activity
              </SelectItem>
              <SelectItem value={ListSupportTicketsSort.updated_asc}>
                Oldest activity
              </SelectItem>
              <SelectItem value={ListSupportTicketsSort.created_desc}>
                Recently created
              </SelectItem>
              <SelectItem value={ListSupportTicketsSort.priority_desc}>
                Priority (high → low)
              </SelectItem>
            </SelectContent>
          </Select>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-md hover:bg-muted text-muted-foreground transition-colors"
            title="Refresh"
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background p-4">
        <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[300px]">Subject & Requester</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Related Adventure</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="text-right">Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-24 ml-auto" />
                    </TableCell>
                  </TableRow>
                ))
              ) : tickets.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No tickets found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                    onClick={() => setLocation(`/tickets/${ticket.id}`)}
                    data-testid={`row-ticket-${ticket.id}`}
                  >
                    <TableCell>
                      <div className="font-medium truncate group-hover:text-primary transition-colors">
                        {ticket.subject}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {ticket.requester.name}
                        </span>
                        <RoleBadge role={ticket.requester.role} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={ticket.status} />
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={ticket.priority} />
                    </TableCell>
                    <TableCell>
                      {ticket.tripId ? (
                        <div className="flex items-center text-xs text-muted-foreground bg-muted w-fit px-2 py-1 rounded">
                          <Car className="w-3 h-3 mr-1" />
                          Adventure ID: {ticket.tripId.slice(0, 8)}
                        </div>
                      ) : (
                        <span className="text-muted-foreground opacity-50 text-xs">
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {ticket.assigneeName ? (
                        <span className="text-sm font-medium">
                          {ticket.assigneeName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="text-sm">
                        {format(new Date(ticket.updatedAt), "MMM d, h:mm a")}
                      </div>
                      {ticket.messageCount !== undefined && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {ticket.messageCount} msg
                          {ticket.messageCount !== 1 && "s"}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {!isLoading && tickets.length > 0 && (
          <div className="flex justify-center mt-4">
            {hasNextPage ? (
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                data-testid="button-load-more"
              >
                {isFetchingNextPage ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                Load more
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                Showing all {tickets.length} ticket
                {tickets.length !== 1 && "s"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
