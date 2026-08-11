import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  // 경로는 상대경로여야 한다. 전에는 `path.join(__dirname, …)` 로 절대경로를
  // 줬는데, drizzle-kit 0.31 이 meta 스냅샷을 읽을 때 `./` 를 앞에 덧붙여
  // `.//Users/…/0000_snapshot.json` 을 찾다가 ENOENT 로 죽는다. 그래서
  // `generate` 가 계속 실패했고, 스키마 변경이 전부 `push` 로만 나갔다 —
  // 0000 이후 마이그레이션이 하나도 없는 이유다. 아래 주석이 요구하는 것을
  // 정작 이 설정이 막고 있었다.
  //
  // 반드시 lib/db 안에서 돌린다(`pnpm --filter @workspace/db run generate`).
  schema: "./src/schema/index.ts",
  // 마이그레이션 파일을 남긴다. `push` 만 쓰면 스키마 변경이 어떤 SQL 로
  // 나갔는지 아무 데도 안 남아서, 다른 환경에 같은 상태를 다시 만들 수 없고
  // 무엇이 언제 바뀌었는지 되짚을 수도 없다.
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
