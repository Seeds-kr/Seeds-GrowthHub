import { and, eq } from "drizzle-orm";
import {
  db,
  activityRecordsTable,
  studentCohortsTable,
  type ActivitySource,
} from "@workspace/db";
import { logger } from "./logger";

/**
 * 활동 타임라인 자동 기록 (docs/design/07-activity-timeline.md).
 *
 * 다섯 곳(과제 제출·산출물 등록·회고 작성·회의록 작성·출석 저장)이 이 함수
 * 하나를 거친다. 각자 insert 하면 cohortId 채우는 규칙과 실패 처리가 다섯 벌로
 * 갈린다 — `audit()` / `notifyDiscord()` 가 쓰는 모양을 그대로 따랐다.
 *
 * ⚠️ ADR-013 — 기록하는 것은 "학생이 남긴 것"뿐이다.
 * 로그인·화면 열람·조회수는 넣지 않는다. 활동이 아니라 접속이고, 설계 00 §8 이
 * "활동량 추적 → 감시가 된다"고 그은 선의 안쪽이다. 멘토 피드백도 넣지 않는다 —
 * 남이 나에 대해 쓴 것이 "내가 한 일"로 섞이면 안 된다. `sourceType` 에
 * `feedback` 이 있지만 열거값이 있다고 채워야 하는 것은 아니다.
 */

type RecordInput = {
  studentId: number;
  sourceType: ActivitySource;
  /** 원본 객체 id. 중복 판정에도 쓴다. */
  sourceId: number;
  title: string;
  description?: string | null;
  activityDate?: Date;
  /** 사건 자체가 기수를 아는 경우(과제·모임). 없으면 학생의 기수를 찾는다. */
  cohortId?: number | null;
};

/** 학생의 기수. 여럿이면 가장 최근 것. */
async function resolveCohortId(studentId: number): Promise<number | null> {
  const [row] = await db
    .select({ id: studentCohortsTable.cohortId })
    .from(studentCohortsTable)
    .where(eq(studentCohortsTable.studentId, studentId))
    .orderBy(studentCohortsTable.cohortId)
    .limit(1);
  return row?.id ?? null;
}

/**
 * 타임라인에 한 줄 남긴다.
 *
 * ADR-014 — 절대 throw 하지 않는다. 과제 제출이 성공했는데 기록 한 줄을 못 써서
 * 500 이 나면 학생은 제출을 잃는다. 부차적 기록이 본체를 인질로 잡아서는 안 된다.
 * 그래서 호출부는 `void recordActivity(...)` 로 불러도 안전하다.
 */
export async function recordActivity(input: RecordInput): Promise<void> {
  try {
    const cohortId = input.cohortId ?? (await resolveCohortId(input.studentId));
    if (!cohortId) {
      // 기수 없는 학생의 활동은 어느 기수 리포트에도 실리지 않는다. 컬럼이
      // notNull 이라 억지로 넣을 수도 없으므로 조용히 건너뛴다.
      return;
    }

    // 같은 원본에 대한 기록이 이미 있으면 넣지 않는다. 출석은 운영진이 고쳐
    // 넣을 때마다 저장되고, 과제도 다시 제출하면 갱신이지 새 사건이 아니다.
    // 없으면 타임라인이 같은 모임으로 도배된다.
    const [dupe] = await db
      .select({ id: activityRecordsTable.id })
      .from(activityRecordsTable)
      .where(
        and(
          eq(activityRecordsTable.studentId, input.studentId),
          eq(activityRecordsTable.sourceType, input.sourceType),
          eq(activityRecordsTable.sourceId, input.sourceId),
        ),
      )
      .limit(1);
    if (dupe) return;

    await db.insert(activityRecordsTable).values({
      studentId: input.studentId,
      cohortId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      title: input.title,
      description: input.description ?? null,
      activityDate: input.activityDate ?? new Date(),
      // ADR-015 — `private` 로 넣으면 본인도 못 본다(/student/timeline 이
      // student_visible 만 읽는다). 그러면 "학생이 스스로 본다"가 통째로 사라진다.
      visibility: "student_visible",
    });
  } catch (err) {
    logger.warn(
      { err, studentId: input.studentId, sourceType: input.sourceType },
      "activity record failed (본래 동작에는 영향 없음)",
    );
  }
}
