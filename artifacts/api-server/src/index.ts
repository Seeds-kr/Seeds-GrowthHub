import app from "./app";
import { logger } from "./lib/logger";
import { backfillOpsRolesOnce, bootstrapAdminFromEnv } from "./lib/auth";
import { bootstrapSiteContents } from "./lib/site-content-defaults";
import { bootstrapMentors } from "./lib/mentor-seed";
import { backfillMeetingBodies, bootstrapMeetingTemplates } from "./lib/meeting-templates";
import { db, siteContentsTable } from "@workspace/db";

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

async function start() {
  // ORDER MATTERS (ADR-002): the backfill only runs while no user holds any ops
  // role. bootstrapAdminFromEnv grants program_lead to the env admin, which
  // would satisfy that guard and leave every OTHER existing admin with zero ops
  // roles — locked out of finance/recruitment. Backfill first.
  try {
    await backfillOpsRolesOnce();
  } catch (err) {
    logger.error({ err }, "Failed to backfill ops roles");
  }
  try {
    await bootstrapAdminFromEnv();
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap admin user");
  }
  try {
    await bootstrapSiteContents(db, siteContentsTable);
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap site contents");
  }
  try {
    // Seed first so a brand-new install has templates before any meeting is
    // created; the backfill only touches rows whose bodyMd is still empty.
    await bootstrapMeetingTemplates();
    await backfillMeetingBodies();
  } catch (err) {
    logger.error({ err }, "Failed to prepare meeting templates");
  }
  try {
    await bootstrapMentors();
  } catch (err) {
    logger.error({ err }, "Failed to bootstrap mentor profiles");
  }
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

void start();
