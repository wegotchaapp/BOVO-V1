# Checkout printer reset

Requested by Sushant; implemented exclusively by Codex in the agreed worktree.

Deleted the prior components/TicketPrinter.tsx, components/Ticket.tsx and
app/ticket-preview.tsx. Removed their imports, stage timers, feed animations,
haptics and decorative badges from app/booking-confirmed.tsx. The booking route
now shows the actual booking status, route, departure, seats, Voyager and total,
with loading/error/retry handling and existing navigation preserved.

This is the clean starting point, not the replacement printer design. The new
printer and transitions will be rebuilt from the user's reference sample.

Verification: pnpm run release:check exit 0; workspace type checks, 39 mobile
tests and production iOS/Android/web exports pass. No remaining source references
to the removed printer/preview components; git diff --check clean. No dependencies
or payment API contracts changed by this reset. Physical device QA remains.
