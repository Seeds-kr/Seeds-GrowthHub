import { and, eq } from "drizzle-orm";
import {
  db,
  peopleProfilesTable,
  type InsertPeopleProfile,
} from "@workspace/db";
import { logger } from "./logger";

// Seed data sourced from the club's mentor roster CSV (Notion export).
// Each row is inserted only if no mentor profile with the same `name` exists,
// so admins can edit/delete a mentor without it being re-inserted on every
// boot. `displayOrder` preserves roster ordering.
const MENTOR_SEED: Array<
  Omit<InsertPeopleProfile, "id" | "createdAt" | "updatedAt" | "kind">
> = [
  {
    name: "최광선 (Kwang Sun Choi)",
    roleTitle: "엑셀러레이터 · 소프트웨어 엔지니어 · 데이터 분석가",
    affiliation: "더이노베이터스",
    bio: null,
    photoUrl: null,
    tags: [
      "SW아키텍처",
      "SW품질",
      "데이터분석",
      "심볼릭추론",
      "인공지능",
      "백엔드",
      "서비스기획",
      "프론트엔드",
    ],
    displayOrder: 1,
    isPublic: true,
  },
  {
    name: "강진범",
    roleTitle: "백엔드 · AI/ML",
    affiliation: "더이노베이터스 · 자이냅스",
    bio: null,
    photoUrl: null,
    tags: [
      "SW아키텍처",
      "SW테스트",
      "SW품질",
      "데이터분석",
      "딥러닝",
      "머신러닝",
      "심볼릭추론",
      "인공지능",
      "백엔드",
    ],
    displayOrder: 2,
    isPublic: true,
  },
  {
    name: "정경민",
    roleTitle: "DBA · SW아키텍처 · 인공지능",
    affiliation: "더이노베이터스 · 뷰메진 · 엔코아",
    bio: "이성으로 비관하되 의지로 낙관한다",
    photoUrl: null,
    tags: [
      "DBA",
      "SW아키텍처",
      "데이터분석",
      "딥러닝",
      "머신러닝",
      "백엔드 API",
      "인공지능",
      "AWS",
      "C++",
      "GCP",
      "GoLang",
      "Javascript",
      "NoSQL",
      "Python",
      "SQL",
      "k8s",
    ],
    displayOrder: 3,
    isPublic: true,
  },
  {
    name: "방요셉",
    roleTitle: "풀스택 · 클라우드",
    affiliation: "SY컴퍼니",
    bio: null,
    photoUrl: null,
    tags: [
      "AWS",
      "Javascript",
      "Python",
      "백엔드",
      "서비스기획",
      "프론트엔드",
    ],
    displayOrder: 4,
    isPublic: true,
  },
  {
    name: "유성호",
    roleTitle: "SW아키텍처 · SW품질 · 데이터분석",
    affiliation: "더이노베이터스",
    bio: null,
    photoUrl: null,
    tags: [
      "SW아키텍처",
      "SW품질",
      "데이터분석",
      "Javascript",
      "SQL",
      "백엔드",
      "서비스기획",
      "프론트엔드",
    ],
    displayOrder: 5,
    isPublic: true,
  },
  {
    name: "김태성",
    roleTitle: null,
    affiliation: "퍼즐벤처스",
    bio: null,
    photoUrl: null,
    tags: [],
    displayOrder: 6,
    isPublic: true,
  },
  {
    name: "박수현",
    roleTitle: null,
    affiliation: "젠아이랩스",
    bio: null,
    photoUrl: null,
    tags: [],
    displayOrder: 7,
    isPublic: true,
  },
  {
    name: "김지홍",
    roleTitle: null,
    affiliation: "더이노베이터스",
    bio: null,
    photoUrl: null,
    tags: [],
    displayOrder: 8,
    isPublic: true,
  },
  {
    name: "이창희",
    roleTitle: null,
    affiliation: "풋스케치",
    bio: null,
    photoUrl: null,
    tags: [],
    displayOrder: 9,
    isPublic: true,
  },
];

export async function bootstrapMentors() {
  let inserted = 0;
  for (const m of MENTOR_SEED) {
    const existing = await db
      .select({ id: peopleProfilesTable.id })
      .from(peopleProfilesTable)
      .where(
        and(
          eq(peopleProfilesTable.kind, "mentor"),
          eq(peopleProfilesTable.name, m.name),
        ),
      )
      .limit(1);
    if (existing.length > 0) continue;
    await db.insert(peopleProfilesTable).values({ kind: "mentor", ...m });
    inserted += 1;
  }
  if (inserted > 0) {
    logger.info({ inserted }, "Bootstrapped mentor profiles");
  }
}
