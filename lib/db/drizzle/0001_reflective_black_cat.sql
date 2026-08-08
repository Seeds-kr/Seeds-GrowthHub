CREATE TABLE "team_meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" integer NOT NULL,
	"title" text NOT NULL,
	"met_at" timestamp with time zone DEFAULT now() NOT NULL,
	"content_md" text DEFAULT '' NOT NULL,
	"author_id" integer,
	"last_edited_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_meetings" ADD CONSTRAINT "team_meetings_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_meetings" ADD CONSTRAINT "team_meetings_last_edited_by_users_id_fk" FOREIGN KEY ("last_edited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_meetings_owner_idx" ON "team_meetings" USING btree ("owner_type","owner_id","met_at");