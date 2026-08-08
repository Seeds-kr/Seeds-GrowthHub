CREATE TABLE "team_meeting_participants" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_meetings" ADD COLUMN "tags" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_meeting_participants" ADD CONSTRAINT "team_meeting_participants_meeting_id_team_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."team_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_meeting_participants" ADD CONSTRAINT "team_meeting_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "team_meeting_participants_unique" ON "team_meeting_participants" USING btree ("meeting_id","user_id");--> statement-breakpoint
CREATE INDEX "team_meeting_participants_user_idx" ON "team_meeting_participants" USING btree ("user_id");