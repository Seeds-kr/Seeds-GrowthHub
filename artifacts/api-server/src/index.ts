import app from "./app";
import { logger } from "./lib/logger";
import { bootstrapAdminFromEnv } from "./lib/auth";
import { bootstrapSiteContents } from "./lib/site-content-defaults";
import { bootstrapMentors } from "./lib/mentor-seed";
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
