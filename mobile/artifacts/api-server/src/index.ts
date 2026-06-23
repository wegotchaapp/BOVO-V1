import app from "./app";
import { logger } from "./lib/logger";
import { initStripe } from "./lib/initStripe";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Start listening first so health checks pass while Stripe initializes asynchronously.
app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Kick off Stripe initialization in the background. Failures are logged
  // inside initStripe and do not prevent the server from running — useful
  // when running locally without a Stripe connector configured.
  void initStripe();
});
