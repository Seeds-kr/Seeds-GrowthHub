import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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
/**
 * CORS.
 *
 * This used to be `{ origin: true, credentials: true }`, which reflects
 * whatever `Origin` the caller sends and pairs it with
 * `Access-Control-Allow-Credentials: true` — i.e. any site could make
 * credentialed calls to this API and read the responses. `SameSite=Lax` on the
 * session cookie is what kept that from being exploitable today, but that makes
 * one cookie attribute the only thing standing between us and account takeover;
 * flipping it to `None` for an embed would silently open the hole.
 *
 * The app is served same-origin (the Replit router, or the local preview
 * router, puts the SPA and `/api` on one origin), so cross-origin credentialed
 * access buys nothing. Default is therefore no CORS at all.
 *
 * Set `ALLOWED_ORIGINS` (comma-separated, exact origins) only if a genuinely
 * separate front end ever needs in.
 */
const allowedOrigins = (process.env["ALLOWED_ORIGINS"] ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        // No Origin header = same-origin or a non-browser client; allow.
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        // Reject by omitting the header rather than erroring, so the browser
        // blocks it and the response body stays a normal API error.
        callback(null, false);
      },
    }),
  );
  logger.info({ allowedOrigins }, "CORS enabled for explicit origins");
}
app.use(cookieParser());
// 10mb to comfortably fit a base64-encoded reference photo for AI avatar
// generation (~5MB raw image). All other endpoints accept tiny JSON.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

export default app;
