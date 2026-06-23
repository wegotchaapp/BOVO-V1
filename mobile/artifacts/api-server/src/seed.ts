import {
  db,
  pool,
  supportAgentsTable,
  supportTicketsTable,
  supportTicketMessagesTable,
} from "@workspace/db";
import { hashPassword } from "./lib/password";

type AgentSeed = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "agent";
};

type MessageSeed = {
  body: string;
  authorType: "customer" | "agent" | "system";
  authorName: string;
  internal?: boolean;
  authorAgentId?: string | null;
  hoursAgo: number;
};

type TicketSeed = {
  id: string;
  subject: string;
  status: "open" | "pending" | "resolved";
  priority: "low" | "normal" | "high" | "urgent";
  requester: {
    name: string;
    role: "rider" | "driver";
    email: string;
    phone?: string;
    avatarUrl?: string;
  };
  trip?: {
    id: string;
    origin: string;
    destination: string;
    departureHoursFromNow: number;
    driverName?: string;
    priceCents?: number;
  };
  assigneeId?: string | null;
  daysAgo: number;
  firstResponseHoursLater?: number;
  messages: MessageSeed[];
};

const agents: AgentSeed[] = [
  {
    id: "agt_seed_admin",
    name: "Maya Alvarez",
    email: "maya@saferide.support",
    password: "support123",
    role: "admin",
  },
  {
    id: "agt_seed_jordan",
    name: "Jordan Patel",
    email: "jordan@saferide.support",
    password: "support123",
    role: "agent",
  },
  {
    id: "agt_seed_riley",
    name: "Riley Chen",
    email: "riley@saferide.support",
    password: "support123",
    role: "agent",
  },
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function relTime(daysAgo: number, plusHours = 0): Date {
  return new Date(Date.now() - daysAgo * DAY + plusHours * HOUR);
}

const tickets: TicketSeed[] = [
  {
    id: "tkt_seed_001",
    subject: "Driver never showed up at pickup",
    status: "open",
    priority: "urgent",
    requester: {
      name: "Eliza Thompson",
      role: "rider",
      email: "eliza.t@example.com",
      phone: "+1 512 555 0144",
    },
    trip: {
      id: "trip_dal_aus_447",
      origin: "Dallas, TX",
      destination: "Austin, TX",
      departureHoursFromNow: -3,
      driverName: "Marcus Webb",
      priceCents: 4200,
    },
    assigneeId: null,
    daysAgo: 0,
    messages: [
      {
        body: "I waited 25 minutes at the pickup point in Dallas and the driver Marcus never arrived. He stopped responding to messages. I had to book a last-minute Greyhound. Please help.",
        authorType: "customer",
        authorName: "Eliza Thompson",
        hoursAgo: 1.5,
      },
    ],
  },
  {
    id: "tkt_seed_002",
    subject: "Refund request — driver canceled last minute",
    status: "pending",
    priority: "high",
    requester: {
      name: "Devon Brooks",
      role: "rider",
      email: "devon@example.com",
      phone: "+1 713 555 0102",
    },
    trip: {
      id: "trip_hou_sat_221",
      origin: "Houston, TX",
      destination: "San Antonio, TX",
      departureHoursFromNow: -36,
      driverName: "Priya Shah",
      priceCents: 3800,
    },
    assigneeId: "agt_seed_jordan",
    daysAgo: 2,
    firstResponseHoursLater: 1.2,
    messages: [
      {
        body: "Driver canceled 40 minutes before departure and there's no other ride for today. Need a full refund please.",
        authorType: "customer",
        authorName: "Devon Brooks",
        hoursAgo: 48,
      },
      {
        body: "Hi Devon — really sorry about that. I've initiated a full refund of $38.00, it should land in 3-5 business days. I'm also flagging this driver for review.",
        authorType: "agent",
        authorName: "Jordan Patel",
        authorAgentId: "agt_seed_jordan",
        hoursAgo: 46.8,
      },
      {
        body: "Refund initiated via Stripe txn re_3PqB2KH. Driver flagged for cancellation review.",
        authorType: "agent",
        authorName: "Jordan Patel",
        authorAgentId: "agt_seed_jordan",
        internal: true,
        hoursAgo: 46.7,
      },
      {
        body: "Thanks Jordan, appreciate the quick response.",
        authorType: "customer",
        authorName: "Devon Brooks",
        hoursAgo: 30,
      },
    ],
  },
  {
    id: "tkt_seed_003",
    subject: "Payout did not land — driver earnings",
    status: "open",
    priority: "high",
    requester: {
      name: "Marcus Webb",
      role: "driver",
      email: "marcus.webb@example.com",
      phone: "+1 469 555 0188",
    },
    assigneeId: "agt_seed_riley",
    daysAgo: 1,
    messages: [
      {
        body: "I completed 4 trips this week but my Friday payout of $214.30 hasn't arrived. Can you check what's going on?",
        authorType: "customer",
        authorName: "Marcus Webb",
        hoursAgo: 18,
      },
    ],
  },
  {
    id: "tkt_seed_004",
    subject: "App crashes when opening trip details",
    status: "open",
    priority: "normal",
    requester: {
      name: "Sasha Greene",
      role: "rider",
      email: "sasha.g@example.com",
    },
    assigneeId: null,
    daysAgo: 1,
    messages: [
      {
        body: "Every time I tap a trip in My Trips the app freezes for 5s and then closes. iPhone 14, iOS 17.4, app version 1.2.0.",
        authorType: "customer",
        authorName: "Sasha Greene",
        hoursAgo: 22,
      },
    ],
  },
  {
    id: "tkt_seed_005",
    subject: "Reporting unsafe driving — Plano to Lubbock",
    status: "pending",
    priority: "urgent",
    requester: {
      name: "Hannah Liu",
      role: "rider",
      email: "hannah.l@example.com",
      phone: "+1 214 555 0173",
    },
    trip: {
      id: "trip_pln_lub_088",
      origin: "Plano, TX",
      destination: "Lubbock, TX",
      departureHoursFromNow: -72,
      driverName: "Brent Coker",
      priceCents: 7600,
    },
    assigneeId: "agt_seed_admin",
    daysAgo: 3,
    firstResponseHoursLater: 0.4,
    messages: [
      {
        body: "Driver Brent was speeding (90+ mph) the entire trip and was on his phone constantly. I felt unsafe and want this on record.",
        authorType: "customer",
        authorName: "Hannah Liu",
        hoursAgo: 72,
      },
      {
        body: "Hannah, thank you for reporting this — your safety is the priority. I've suspended Brent's account pending a review and our trust & safety team will follow up within 24 hours.",
        authorType: "agent",
        authorName: "Maya Alvarez",
        authorAgentId: "agt_seed_admin",
        hoursAgo: 71.6,
      },
      {
        body: "Driver suspended. Escalated to T&S queue. Pull GPS trace from trip_pln_lub_088 for evidence.",
        authorType: "agent",
        authorName: "Maya Alvarez",
        authorAgentId: "agt_seed_admin",
        internal: true,
        hoursAgo: 71.5,
      },
    ],
  },
  {
    id: "tkt_seed_006",
    subject: "Vehicle registration stuck in review",
    status: "open",
    priority: "normal",
    requester: {
      name: "Priya Shah",
      role: "driver",
      email: "priya.shah@example.com",
      phone: "+1 832 555 0119",
    },
    assigneeId: null,
    daysAgo: 4,
    messages: [
      {
        body: "I uploaded my insurance and registration 3 days ago but my vehicle is still 'pending review'. I have trips booked for tomorrow.",
        authorType: "customer",
        authorName: "Priya Shah",
        hoursAgo: 96,
      },
    ],
  },
  {
    id: "tkt_seed_007",
    subject: "Wrong fare charged — should have been split 4 ways",
    status: "resolved",
    priority: "normal",
    requester: {
      name: "Tomas Rivera",
      role: "rider",
      email: "tomas.r@example.com",
    },
    trip: {
      id: "trip_aus_eps_502",
      origin: "Austin, TX",
      destination: "El Paso, TX",
      departureHoursFromNow: -120,
      driverName: "Yara Okafor",
      priceCents: 11400,
    },
    assigneeId: "agt_seed_jordan",
    daysAgo: 5,
    firstResponseHoursLater: 0.8,
    messages: [
      {
        body: "I was charged the full $114 but there were 4 of us in the car so my share should have been ~$28.50.",
        authorType: "customer",
        authorName: "Tomas Rivera",
        hoursAgo: 120,
      },
      {
        body: "You're right — there was a billing bug on that trip. Refunding the difference of $85.50 now.",
        authorType: "agent",
        authorName: "Jordan Patel",
        authorAgentId: "agt_seed_jordan",
        hoursAgo: 119.2,
      },
      {
        body: "Got it, thank you!",
        authorType: "customer",
        authorName: "Tomas Rivera",
        hoursAgo: 118,
      },
      {
        body: "Status changed to resolved",
        authorType: "system",
        authorName: "System",
        internal: true,
        hoursAgo: 4,
      },
    ],
  },
  {
    id: "tkt_seed_008",
    subject: "Lost AirPods in Yara's car",
    status: "resolved",
    priority: "low",
    requester: {
      name: "Cameron Bell",
      role: "rider",
      email: "cam.bell@example.com",
    },
    trip: {
      id: "trip_ftw_wac_311",
      origin: "Fort Worth, TX",
      destination: "Waco, TX",
      departureHoursFromNow: -200,
      driverName: "Yara Okafor",
      priceCents: 3200,
    },
    assigneeId: "agt_seed_riley",
    daysAgo: 7,
    firstResponseHoursLater: 2,
    messages: [
      {
        body: "I think I left my white AirPods Pro case in the back seat of Yara's silver Civic.",
        authorType: "customer",
        authorName: "Cameron Bell",
        hoursAgo: 168,
      },
      {
        body: "I reached out to Yara — she found them and is shipping them to you Monday. Tracking will follow.",
        authorType: "agent",
        authorName: "Riley Chen",
        authorAgentId: "agt_seed_riley",
        hoursAgo: 166,
      },
      {
        body: "Status changed to resolved",
        authorType: "system",
        authorName: "System",
        internal: true,
        hoursAgo: 24,
      },
    ],
  },
  {
    id: "tkt_seed_009",
    subject: "Account locked after password reset",
    status: "open",
    priority: "low",
    requester: {
      name: "Noor Hassan",
      role: "rider",
      email: "noor.h@example.com",
    },
    assigneeId: null,
    daysAgo: 0,
    messages: [
      {
        body: "I reset my password but now I'm getting 'account locked' on every login attempt.",
        authorType: "customer",
        authorName: "Noor Hassan",
        hoursAgo: 4,
      },
    ],
  },
  {
    id: "tkt_seed_010",
    subject: "1099-K threshold question for driver earnings",
    status: "pending",
    priority: "low",
    requester: {
      name: "Brent Coker",
      role: "driver",
      email: "brent.c@example.com",
    },
    assigneeId: "agt_seed_admin",
    daysAgo: 6,
    firstResponseHoursLater: 4,
    messages: [
      {
        body: "Will I get a 1099-K if I make under $600 in cost-recovery this year?",
        authorType: "customer",
        authorName: "Brent Coker",
        hoursAgo: 144,
      },
      {
        body: "Hi Brent — under the current IRS threshold ($600), no 1099-K is issued. We do still surface a year-end summary in your earnings dashboard for your records.",
        authorType: "agent",
        authorName: "Maya Alvarez",
        authorAgentId: "agt_seed_admin",
        hoursAgo: 140,
      },
    ],
  },
];

async function seed() {
  const existing = await db.select().from(supportAgentsTable);
  if (existing.length > 0) {
    console.log(
      `Seed skipped: ${existing.length} support agents already exist.`,
    );
    return;
  }

  for (const a of agents) {
    await db.insert(supportAgentsTable).values({
      id: a.id,
      name: a.name,
      email: a.email.toLowerCase(),
      passwordHash: hashPassword(a.password),
      role: a.role,
    });
  }

  for (const t of tickets) {
    const createdAt = relTime(t.daysAgo);
    const firstResponseAt = t.firstResponseHoursLater
      ? new Date(createdAt.getTime() + t.firstResponseHoursLater * HOUR)
      : null;
    const lastMsg = t.messages[t.messages.length - 1];
    const updatedAt = lastMsg
      ? new Date(Date.now() - lastMsg.hoursAgo * HOUR)
      : createdAt;
    await db.insert(supportTicketsTable).values({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      requesterName: t.requester.name,
      requesterRole: t.requester.role,
      requesterEmail: t.requester.email,
      requesterPhone: t.requester.phone ?? null,
      requesterAvatarUrl: t.requester.avatarUrl ?? null,
      tripId: t.trip?.id ?? null,
      tripOrigin: t.trip?.origin ?? null,
      tripDestination: t.trip?.destination ?? null,
      tripDepartureAt: t.trip
        ? new Date(Date.now() + t.trip.departureHoursFromNow * HOUR)
        : null,
      tripDriverName: t.trip?.driverName ?? null,
      tripPriceCents: t.trip?.priceCents ?? null,
      assigneeId: t.assigneeId ?? null,
      firstAgentResponseAt: firstResponseAt,
      createdAt,
      updatedAt,
    });
    let i = 0;
    for (const m of t.messages) {
      i += 1;
      await db.insert(supportTicketMessagesTable).values({
        id: `${t.id}_m${i}`,
        ticketId: t.id,
        body: m.body,
        authorType: m.authorType,
        authorName: m.authorName,
        authorAgentId: m.authorAgentId ?? null,
        internal: m.internal ?? false,
        createdAt: new Date(Date.now() - m.hoursAgo * HOUR),
      });
    }
  }

  console.log(
    `Seeded ${agents.length} agents and ${tickets.length} tickets.`,
  );
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err);
    pool.end();
    process.exit(1);
  });
