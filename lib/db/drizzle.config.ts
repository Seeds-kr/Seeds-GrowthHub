import { defineConfig } from "drizzle-kit";
import path from "path";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  // 마이그레이션 파일을 남긴다. `push` 만 쓰면 스키마 변경이 어떤 SQL 로
  // 나갔는지 아무 데도 안 남아서, 다른 환경에 같은 상태를 다시 만들 수 없고
  // 무엇이 언제 바뀌었는지 되짚을 수도 없다.
  out: path.join(__dirname, "./drizzle"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
