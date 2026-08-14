/** Verifies the flat cost-share model and fee economics against the real config. */
const path = require('path');
// Resolve from the backend root so this runs from anywhere.
const BACKEND = path.resolve(__dirname, '..', '..');
const {
  PRICING, seatPriceForMiles, platformFeeForSubtotal,
  irsCeilingForMiles, breachesCostShareCeiling,
} = require(path.join(BACKEND, 'dist/modules/pricing/pricing.config'));

let bad = 0;
const ok = (l, c, d) => { if (!c) bad++; console.log(`${c ? 'PASS' : 'FAIL'}  ${l}${d ? `  → ${d}` : ''}`); };

console.log('=== Flat price ===');
ok('seat = $32.40', seatPriceForMiles(180) === 32.4, `$${seatPriceForMiles(180)}`);
ok('same on every route', seatPriceForMiles(79) === 32.4 && seatPriceForMiles(400) === 32.4, 'flat');
ok('derives from 180mi', Math.abs(180 * PRICING.IRS_RATE * PRICING.SAFETY_FACTOR / 3 - 32.4) < 0.001, '');

console.log('\n=== Share of IRS ceiling at full occupancy ===');
console.log('miles   3 seats   IRS ceiling   % of ceiling   flagged?');
for (const m of [35, 60, 79, 135, 162, 180, 195, 239, 400]) {
  const collected = seatPriceForMiles(m) * PRICING.STANDARD_OCCUPANCY_SEDAN;
  const ceiling = irsCeilingForMiles(m);
  const pct = (collected / ceiling) * 100;
  const flagged = breachesCostShareCeiling(m);
  console.log(
    `${String(m).padStart(5)}   ${('$'+collected.toFixed(2)).padStart(7)}   ${('$'+ceiling.toFixed(2)).padStart(11)}   ` +
    `${(pct.toFixed(1)+'%').padStart(12)}   ${flagged ? 'YES — ops review' : 'no'}`);
  ok(`  ${m}mi flag matches >100%`, flagged === (pct > 100), `${pct.toFixed(1)}%`);
}

console.log('\n=== Stripe economics ===');
for (const [label, seats, ins] of [
  ['1 seat, no insurance', 1, 0], ['1 seat + insurance', 1, 1],
  ['2 seats + insurance', 2, 2], ['3 seats + insurance', 3, 3],
]) {
  const sub = seatPriceForMiles(180) * seats + ins * PRICING.INSURANCE_PREMIUM;
  const fee = platformFeeForSubtotal(sub);
  const total = sub + fee;
  const stripe = PRICING.STRIPE_PERCENT * total + PRICING.STRIPE_FIXED;
  const net = fee - stripe;
  console.log(`${label.padEnd(24)} sub $${sub.toFixed(2).padStart(7)}  fee $${fee.toFixed(2).padStart(5)}  net $${net.toFixed(2)}`);
  ok(`  ${label}: net = $2.00`, Math.abs(net - PRICING.PLATFORM_TARGET_MARGIN) < 0.02, `$${net.toFixed(2)}`);
}
console.log(`\n${bad === 0 ? 'ALL PRICING CHECKS PASSED' : bad + ' FAILED'}`);
process.exit(bad === 0 ? 0 : 1);
