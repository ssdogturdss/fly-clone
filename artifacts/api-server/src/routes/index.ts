import { Router, type IRouter } from "express";
import healthRouter from "./health";
import serverRouter from "./server";
import githubRouter from "./github";
import filesRouter from "./files";

const router: IRouter = Router();

router.use(healthRouter);
router.use(serverRouter);
router.use(githubRouter);
router.use(filesRouter);

export default router;
