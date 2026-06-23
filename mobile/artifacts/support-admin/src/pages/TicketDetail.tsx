import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { format } from "date-fns";
import { 
  useGetSupportTicket, 
  useUpdateSupportTicket, 
  usePostSupportTicketMessage,
  useListSupportAgents,
  type TicketStatus,
  type TicketPriority
} from "@workspace/api-client-react";
import { getGetSupportTicketQueryKey, getListSupportTicketsQueryKey, getGetSupportDashboardOverviewQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { StatusBadge, PriorityBadge, RoleBadge } from "../components/TicketBadges";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send, Lock, User, Mail, Phone, Clock, Car, MapPin } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "../context/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function TicketDetail() {
  const [, params] = useRoute("/tickets/:id");
  const ticketId = params?.id;
  const { agent } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const { data: ticket, isLoading } = useGetSupportTicket(ticketId!, {
    query: {
      queryKey: getGetSupportTicketQueryKey(ticketId!),
      enabled: !!ticketId,
    },
  });
  
  const { data: agents } = useListSupportAgents();
  
  const updateTicket = useUpdateSupportTicket();
  const postMessage = usePostSupportTicketMessage();

  const handleUpdate = (data: { status?: TicketStatus, priority?: TicketPriority, assigneeId?: string | null }) => {
    if (!ticketId) return;
    
    updateTicket.mutate({ id: ticketId, data }, {
      onSuccess: (updatedTicket) => {
        queryClient.setQueryData(getGetSupportTicketQueryKey(ticketId), updatedTicket);
        queryClient.invalidateQueries({ queryKey: getListSupportTicketsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSupportDashboardOverviewQueryKey() });
        toast({ title: "Ticket updated" });
      },
      onError: () => toast({ title: "Failed to update ticket", variant: "destructive" })
    });
  };

  const handleReply = () => {
    if (!ticketId || !message.trim()) return;

    postMessage.mutate({ id: ticketId, data: { body: message, internal: isInternal } }, {
      onSuccess: (updatedTicket) => {
        setMessage("");
        queryClient.setQueryData(getGetSupportTicketQueryKey(ticketId), updatedTicket);
        queryClient.invalidateQueries({ queryKey: getListSupportTicketsQueryKey() });
        // Automatically change status to pending if it was open and we replied publicly
        if (!isInternal && ticket?.status === "open") {
          handleUpdate({ status: "pending" });
        }
      },
      onError: () => toast({ title: "Failed to post message", variant: "destructive" })
    });
  };

  if (isLoading || !ticket) {
    return <div className="p-8"><Skeleton className="h-12 w-1/3 mb-6" /><Skeleton className="h-[500px]" /></div>;
  }

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-background">
      {/* Main Content Area - Thread */}
      <div className="flex-1 flex flex-col min-w-0 border-r">
        <div className="p-4 border-b bg-card shrink-0 flex items-center gap-4">
          <Link href="/inbox" className="p-2 hover:bg-muted rounded-md text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate" data-testid="ticket-subject">{ticket.subject}</h1>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              Ticket #{ticket.id.slice(0, 8)} • Created {format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a")}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Select value={ticket.status} onValueChange={(val) => handleUpdate({ status: val as TicketStatus })}>
              <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ticket.priority} onValueChange={(val) => handleUpdate({ priority: val as TicketPriority })}>
              <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-6">
          {ticket.messages.map((msg) => {
            const isCustomer = msg.authorType === "customer";
            const isSystem = msg.authorType === "system";
            
            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-4">
                  <div className="bg-muted px-4 py-1.5 rounded-full text-xs font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {msg.body}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex gap-4 max-w-3xl ${isCustomer ? "" : "ml-auto flex-row-reverse"}`}>
                <Avatar className="w-8 h-8 shrink-0">
                  <AvatarFallback className={isCustomer ? "bg-primary/10 text-primary" : msg.internal ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500" : "bg-primary text-primary-foreground"}>
                    {msg.authorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex flex-col gap-1 min-w-0 ${isCustomer ? "items-start" : "items-end"}`}>
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm font-medium">{msg.authorName}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(msg.createdAt), "h:mm a")}</span>
                    {msg.internal && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 text-[10px] py-0 h-4 uppercase tracking-wider">Internal</Badge>}
                  </div>
                  <div 
                    className={`p-3 rounded-2xl text-sm whitespace-pre-wrap ${
                      msg.internal 
                        ? "bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-100 dark:border-amber-900/50 rounded-tr-sm" 
                        : isCustomer 
                          ? "bg-muted text-foreground rounded-tl-sm" 
                          : "bg-primary text-primary-foreground rounded-tr-sm"
                    }`}
                  >
                    {msg.body}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t bg-card shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <button 
              className={`text-sm font-medium pb-1 border-b-2 px-1 transition-colors ${!isInternal ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setIsInternal(false)}
            >
              Public Reply
            </button>
            <button 
              className={`text-sm font-medium pb-1 border-b-2 px-1 transition-colors flex items-center gap-1.5 ${isInternal ? "border-amber-500 text-amber-600 dark:text-amber-500" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setIsInternal(true)}
            >
              <Lock className="w-3.5 h-3.5" /> Internal Note
            </button>
          </div>
          <div className={`border rounded-xl focus-within:ring-1 focus-within:ring-ring transition-shadow ${isInternal ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50" : "bg-background"}`}>
            <Textarea 
              placeholder={isInternal ? "Type a private note visible only to agents..." : "Type your reply to the customer..."}
              className={`border-0 focus-visible:ring-0 resize-none min-h-[100px] bg-transparent ${isInternal ? "placeholder:text-amber-600/50 text-amber-900 dark:text-amber-100" : ""}`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              data-testid="textarea-message"
            />
            <div className="flex justify-between items-center p-2 border-t border-inherit">
              <div className="text-xs text-muted-foreground px-2">
                {isInternal ? "This note will NOT be visible to the customer." : "This reply will be sent directly to the customer."}
              </div>
              <Button 
                size="sm" 
                onClick={handleReply} 
                disabled={!message.trim() || postMessage.isPending}
                className={isInternal ? "bg-amber-600 hover:bg-amber-700 text-white" : ""}
                data-testid={isInternal ? "button-send-internal" : "button-send-reply"}
              >
                {postMessage.isPending ? "Sending..." : "Send"}
                <Send className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Context */}
      <div className="w-full lg:w-80 flex flex-col bg-muted/20 overflow-auto">
        <div className="p-4 space-y-6">
          
          {/* Requester Info */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Requester</h3>
            <div className="bg-card border rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={ticket.requester.avatarUrl || ""} />
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">{ticket.requester.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-semibold text-sm">{ticket.requester.name}</div>
                  <RoleBadge role={ticket.requester.role} />
                </div>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                {ticket.requester.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span className="truncate">{ticket.requester.email}</span>
                  </div>
                )}
                {ticket.requester.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{ticket.requester.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Assignment</h3>
            <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
              <Select 
                value={ticket.assigneeId || "unassigned"} 
                onValueChange={(val) => handleUpdate({ assigneeId: val === "unassigned" ? null : val })}
              >
                <SelectTrigger className="w-full h-9" data-testid="select-assignee">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Assign to agent" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned" className="italic text-muted-foreground">Unassigned</SelectItem>
                  {agents?.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agent && ticket.assigneeId !== agent.id && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => handleUpdate({ assigneeId: agent.id })}
                >
                  Assign to me
                </Button>
              )}
            </div>
          </div>

          {/* Related Adventure */}
          {ticket.trip && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Related Adventure</h3>
              <div className="bg-card border rounded-xl p-4 shadow-sm text-sm">
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <div className="font-mono text-xs text-muted-foreground">#{ticket.trip.id.slice(0,8)}</div>
                  {ticket.trip.priceCents && <div className="font-semibold text-green-600 dark:text-green-500">${(ticket.trip.priceCents / 100).toFixed(2)}</div>}
                </div>
                <div className="relative pl-5 space-y-4 mb-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted">
                  <div className="relative">
                    <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full border-2 border-primary bg-background"></div>
                    <div className="text-muted-foreground text-xs uppercase font-medium">Origin</div>
                    <div className="font-medium mt-0.5">{ticket.trip.origin}</div>
                  </div>
                  <div className="relative">
                    <div className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full border-2 border-destructive bg-background"></div>
                    <div className="text-muted-foreground text-xs uppercase font-medium">Destination</div>
                    <div className="font-medium mt-0.5">{ticket.trip.destination}</div>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2.5 space-y-2 mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Departure</span>
                    <span className="font-medium">{format(new Date(ticket.trip.departureAt), "MMM d, h:mm a")}</span>
                  </div>
                  {ticket.trip.driverName && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><Car className="w-3.5 h-3.5" /> Voyager</span>
                      <span className="font-medium">{ticket.trip.driverName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
