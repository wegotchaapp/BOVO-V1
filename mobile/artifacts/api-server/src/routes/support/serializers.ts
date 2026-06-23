import type {
  SupportAgentRow,
  SupportTicketRow,
  SupportTicketMessageRow,
} from "@workspace/db";

export function agentToDto(agent: SupportAgentRow) {
  return {
    id: agent.id,
    name: agent.name,
    email: agent.email,
    role: agent.role,
    createdAt: agent.createdAt.toISOString(),
  };
}

export function ticketSummaryToDto(
  t: SupportTicketRow,
  opts: {
    assigneeName?: string | null;
    lastMessagePreview?: string | null;
    messageCount: number;
  },
) {
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    requester: {
      name: t.requesterName,
      role: t.requesterRole,
      email: t.requesterEmail,
      phone: t.requesterPhone,
      avatarUrl: t.requesterAvatarUrl,
    },
    tripId: t.tripId,
    assigneeId: t.assigneeId,
    assigneeName: opts.assigneeName ?? null,
    lastMessagePreview: opts.lastMessagePreview ?? null,
    messageCount: opts.messageCount,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

export function messageToDto(m: SupportTicketMessageRow) {
  return {
    id: m.id,
    body: m.body,
    authorType: m.authorType,
    authorName: m.authorName,
    internal: m.internal,
    createdAt: m.createdAt.toISOString(),
  };
}

export function ticketDetailToDto(
  t: SupportTicketRow,
  messages: SupportTicketMessageRow[],
  assigneeName: string | null,
) {
  const trip = t.tripId
    ? {
        id: t.tripId,
        origin: t.tripOrigin ?? "",
        destination: t.tripDestination ?? "",
        departureAt: (t.tripDepartureAt ?? new Date()).toISOString(),
        driverName: t.tripDriverName,
        priceCents: t.tripPriceCents,
      }
    : null;
  return {
    id: t.id,
    subject: t.subject,
    status: t.status,
    priority: t.priority,
    requester: {
      name: t.requesterName,
      role: t.requesterRole,
      email: t.requesterEmail,
      phone: t.requesterPhone,
      avatarUrl: t.requesterAvatarUrl,
    },
    trip,
    assigneeId: t.assigneeId,
    assigneeName,
    messages: messages.map(messageToDto),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}
