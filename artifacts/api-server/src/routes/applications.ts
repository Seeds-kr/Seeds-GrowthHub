import { Router, type IRouter } from "express";
import { CreateApplicationBody } from "@workspace/api-zod";
import { db, applicationsTable } from "@workspace/db";

const router: IRouter = Router();

router.post("/applications", async (req, res) => {
  const parsed = CreateApplicationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid application data" });
    return;
  }
  const data = parsed.data;
  try {
    const [row] = await db
      .insert(applicationsTable)
      .values({
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        phone: data.phone.trim(),
        school: data.school.trim(),
        grade: data.grade.trim(),
        birthYear: data.birthYear,
        interestArea: data.interestArea.trim(),
        motivation: data.motivation.trim(),
        experience: data.experience.trim(),
        problemAwareness: data.problemAwareness.trim(),
        expectation: data.expectation.trim(),
        privacyConsent: data.privacyConsent,
      })
      .returning({ id: applicationsTable.id });
    res.status(201).json({ id: row.id });
  } catch (err) {
    req.log.error({ err }, "failed to create application");
    res.status(500).json({ error: "Failed to submit application" });
  }
});

export default router;
