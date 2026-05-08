import { Router, type IRouter } from "express";
import healthRouter from "./health";
import applicationsRouter from "./applications";
import adminRouter from "./admin";
import adminUsersRouter from "./admin-users";
import adminAssignmentsRouter from "./admin-assignments";
import adminInterviewRouter from "./admin-interview";
import adminDecisionRouter from "./admin-decision";
import evaluatorRouter from "./evaluator";

const router: IRouter = Router();

router.use(healthRouter);
router.use(applicationsRouter);
router.use(adminRouter);
router.use(adminUsersRouter);
router.use(adminAssignmentsRouter);
router.use(adminInterviewRouter);
router.use(adminDecisionRouter);
router.use(evaluatorRouter);

export default router;
