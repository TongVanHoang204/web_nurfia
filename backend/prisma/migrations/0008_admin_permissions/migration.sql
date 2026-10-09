ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_permissions_restricted" BOOLEAN NOT NULL DEFAULT false;
