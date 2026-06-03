ALTER TABLE "chat" ADD COLUMN "contextSummary" text;--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "compactedMessageCount" integer DEFAULT 0 NOT NULL;