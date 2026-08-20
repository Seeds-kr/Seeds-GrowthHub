import { db, communicationLogsTable } from "@workspace/db";
import { logger } from "./logger";

/**
 * Notification dispatch (ADR-007).
 *
 * Discord webhook + in-app badges. No email. No new table — every send is
 * recorded in `communication_logs` with channel='discord'.
 *
 * HARD RULES (docs/design/05 §5.2). These are not style preferences; breaking
 * them turns the club's ops channel into a surveillance feed:
 *   1. Public ops/mentor channels only. Never a DM.
 *   2. NEVER put student names, evaluation content, reflections, or raw
 *      blocker text in the payload. Team/project/cohort names only.
 *   3. The message says WHAT happened plus a link. The content is read inside
 *      GrowthHub, behind the permission checks.
 *   4. No notifications addressed to students.
 *
 * A missing webhook URL is not an error — notifications are best-effort and
 * must never block or fail the operation that triggered them.
 */

export type NotifyChannel = "ops" | "mentor";

export type NotifyInput = {
  channel: NotifyChannel;
  /** One-line headline. Must not contain personal data. */
  content: string;
  /** Optional supporting line. Same restriction. */
  description?: string;
  /** Deep link into GrowthHub, where permissions actually apply. */
  path?: string;
  /** Stable id for dedupe + log filtering, e.g. "team_support". */
  templateId: string;
  relatedObjectType?: string;
  relatedObjectId?: number;
};

/**
 * 채널별 웹훅을 먼저 보고, 없으면 공용 웹훅으로 떨어진다.
 *
 * 채널을 나누는 것이 원래 설계다(운영 소식과 멘토 넛지는 받는 사람이 다르다).
 * 다만 지금 Seeds 는 채널 하나로 운영하기로 했으므로, 둘 다 안 넣고
 * `SEEDS_DISCORD_WEBHOOK_URL` 하나만 넣으면 두 알림이 같은 곳으로 간다.
 *
 * 나중에 나누고 싶으면 채널별 변수를 넣기만 하면 된다 — 그쪽이 먼저이므로
 * 공용 설정을 지우지 않아도 즉시 갈린다. 코드를 되돌릴 필요가 없다.
 */
function webhookUrlFor(channel: NotifyChannel): string | undefined {
  const key =
    channel === "mentor"
      ? "SEEDS_DISCORD_MENTOR_WEBHOOK_URL"
      : "SEEDS_DISCORD_OPS_WEBHOOK_URL";
  return (
    process.env[key]?.trim() ||
    process.env.SEEDS_DISCORD_WEBHOOK_URL?.trim() ||
    undefined
  );
}

function appBaseUrl(): string {
  return process.env.APP_BASE_URL?.trim().replace(/\/$/, "") ?? "";
}

async function record(
  input: NotifyInput,
  status: "sent" | "failed",
  failureReason?: string,
): Promise<void> {
  try {
    await db.insert(communicationLogsTable).values({
      channel: "discord",
      recipientType: "channel",
      recipientAddress: input.channel,
      templateId: input.templateId,
      subject: input.content.slice(0, 300),
      relatedObjectType: input.relatedObjectType ?? null,
      relatedObjectId: input.relatedObjectId ?? null,
      status,
      failureReason: failureReason ?? null,
      sentAt: status === "sent" ? new Date() : null,
    });
  } catch (err) {
    // Logging the send must never break the caller either.
    logger.error({ err }, "failed to record communication log");
  }
}

/**
 * Fire-and-forget. Resolves false when nothing was sent (no webhook
 * configured, or the request failed) — callers should ignore the result.
 */
export async function notifyDiscord(input: NotifyInput): Promise<boolean> {
  const url = webhookUrlFor(input.channel);
  if (!url) {
    logger.debug(
      { templateId: input.templateId, channel: input.channel },
      "discord webhook not configured — skipping notification",
    );
    return false;
  }

  const base = appBaseUrl();
  const link = input.path && base ? `${base}${input.path}` : undefined;

  const payload = {
    content: input.content,
    embeds: input.description || link
      ? [
          {
            description: input.description,
            url: link,
          },
        ]
      : undefined,
  };

  // One retry, then give up. A notification is not worth a retry storm.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        await record(input, "sent");
        return true;
      }
      if (attempt === 1) {
        await record(input, "failed", `HTTP ${res.status}`);
        logger.warn(
          { status: res.status, templateId: input.templateId },
          "discord webhook rejected",
        );
      }
    } catch (err) {
      if (attempt === 1) {
        await record(input, "failed", String((err as Error)?.message ?? err));
        logger.warn({ err, templateId: input.templateId }, "discord webhook failed");
      }
    }
  }
  return false;
}

/**
 * Wrap a notification so a failure can never surface to the caller.
 * Use at mutation sites: `void notifySafely({...})`.
 */
export function notifySafely(input: NotifyInput): void {
  void notifyDiscord(input).catch((err) =>
    logger.error({ err }, "notification dispatch threw"),
  );
}
