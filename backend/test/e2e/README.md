# End-to-end suites

These hit the **running API against the live Supabase database**, assert real
behaviour, and clean up their own rows. They are not unit tests — they exist to
catch the class of bug that only appears once the whole stack is wired together
(wrong money, a gate that doesn't gate, an index that isn't used).

## Running

```bash
# Node is under nvm and not on the default PATH
export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh"

# Start the API. Prefer the compiled build over `start:dev` — repeated
# file-watchers across a long session exhaust file descriptors (ENFILE).
cd backend
npx tsc -p tsconfig.json --outDir dist
node dist/main.js &

# Then, from backend/ (dotenv and pg only resolve here):
node test/e2e/e2e_vehicle.js
node test/e2e/e2e_odometer.js
node test/e2e/e2e_luggage.js
node test/e2e/e2e_messaging.js
node test/e2e/pricing_check.js     # needs dist/ built
```

Each exits non-zero on failure, so they chain with `&&`.

## What each covers

| Suite | Asserts |
|---|---|
| `e2e_vehicle` | VIN format + uniqueness, photo/document requirements, the posting gate is enforced at the **API** not just the UI, and that no full-SSN column exists |
| `e2e_odometer` | Manifest, pickup/dropoff ordering rules, backwards-reading rejection, per-Sailor mileage, trip completion, earnings row |
| `e2e_luggage` | All four luggage tiers × insurance combinations, exact money splits, Bovogo's net stays positive |
| `e2e_messaging` | 1:1 auto-creation, group auto-formation as Sailors join, access control for non-members |
| `pricing_check` | Flat $32.40 at 35–400 mi, IRS-ceiling flags fire exactly when >100%, platform fee nets exactly `PLATFORM_TARGET_MARGIN` at every booking size |

## Conventions

- Test users use **prefixed emails** (`veh_`, `odo_`, `lug_`, `msg_`, `perf_`) so a
  single regex sweeps them and their dependent rows in FK order.
- Every suite that posts an adventure calls `makeVehicleRoadReady()` first —
  they exercise the real vehicle gate rather than bypassing it.
- Cleanup runs at the end of each suite. If one crashes mid-run, sweep manually:
  `DELETE FROM mobile_users WHERE email ~ '^(veh|odo|lug|msg|perf)_'` plus dependents.

## Caveat

These were written against a laptop talking to a remote Supabase (~233ms
round-trip). Latency assertions in `pricing_check` are about **round-trip
count**, not wall-clock milliseconds — don't tighten them to production numbers
without re-measuring where the API actually runs.
