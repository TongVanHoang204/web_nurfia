ALTER TABLE "contact_messages"
ADD COLUMN "reply_subject" VARCHAR(255),
ADD COLUMN "reply_message" TEXT,
ADD COLUMN "reply_delivered" BOOLEAN,
ADD COLUMN "replied_at" TIMESTAMP(3);
