import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { getStripeSync } from "./lib/stripeClient";

const app: Express = express();

// Trust the Replit reverse proxy so express-rate-limit can read X-Forwarded-For
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] }));
app.use(cookieParser());

// Stripe webhook MUST come before express.json() — signature verification
// requires the raw request body. The route path matches the managed webhook
// URL configured at startup via findOrCreateManagedWebhook().
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing signature" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      const sync = await getStripeSync();
      await sync.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      req.log.error({ err }, "stripe webhook failed");
      res.status(400).json({ error: "Webhook processing failed" });
    }
  },
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
