import { Router, type IRouter } from "express";
import healthRouter from "./health";
import supportRouter from "./support";
import authRouter from "./auth";
import earningsRouter from "./earnings";
import tripsRouter from "./trips";
import bookingsRouter from "./bookings";
import groupsRouter from "./groups";
import subscriptionsRouter from "./subscriptions";
import notificationsRouter from "./notifications";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/support", supportRouter);
router.use("/auth", authRouter);
router.use("/earnings", earningsRouter);
router.use("/trips", tripsRouter);
router.use("/bookings", bookingsRouter);
router.use("/groups", groupsRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/notifications", notificationsRouter);

export default router;
