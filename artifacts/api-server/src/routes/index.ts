import { Router, type IRouter } from "express";
import healthRouter from "./health";
import applicationsRouter from "./applications";
import adminRouter from "./admin";
import adminUsersRouter from "./admin-users";
import adminAssignmentsRouter from "./admin-assignments";
import adminInterviewRouter from "./admin-interview";
import adminDecisionRouter from "./admin-decision";
import evaluatorRouter from "./evaluator";
import adminStudentsRouter from "./admin-students";
import adminCohortsRouter from "./admin-cohorts";
import adminProgramsRouter from "./admin-programs";
import adminSessionsRouter from "./admin-sessions";
import adminTasksRouter from "./admin-tasks";
import adminAnnouncementsRouter from "./admin-announcements";
import studentRouter from "./student";

const router: IRouter = Router();

router.use(healthRouter);
router.use(applicationsRouter);
router.use(adminRouter);
router.use(adminUsersRouter);
router.use(adminAssignmentsRouter);
router.use(adminInterviewRouter);
router.use(adminDecisionRouter);
router.use(evaluatorRouter);
router.use(adminStudentsRouter);
router.use(adminCohortsRouter);
router.use(adminProgramsRouter);
router.use(adminSessionsRouter);
router.use(adminTasksRouter);
router.use(adminAnnouncementsRouter);
router.use(studentRouter);

export default router;
