import { Router, type IRouter } from "express";
import authRouter from "./auth";
import agentsRouter from "./agents";
import ticketsRouter from "./tickets";
import dashboardRouter from "./dashboard";
import { requireAgent } from "../../middlewares/require-agent";

const router: IRouter = Router();

router.use("/auth", authRouter);
router.use("/agents", requireAgent, agentsRouter);
router.use("/tickets", requireAgent, ticketsRouter);
router.use("/dashboard", requireAgent, dashboardRouter);

export default router;
