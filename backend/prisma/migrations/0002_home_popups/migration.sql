CREATE TABLE "home_popups" (
  "id" SERIAL NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "subtitle" VARCHAR(255),
  "message" TEXT,
  "image_url" VARCHAR(500),
  "offer_code" VARCHAR(80),
  "button_text" VARCHAR(100),
  "link_url" VARCHAR(500),
  "display_delay_ms" INTEGER NOT NULL DEFAULT 900,
  "show_once_session" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "start_at" TIMESTAMP(3),
  "end_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "home_popups_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "home_popups_is_active_sort_order_idx" ON "home_popups"("is_active", "sort_order");
CREATE INDEX "home_popups_start_at_end_at_idx" ON "home_popups"("start_at", "end_at");

INSERT INTO "home_popups" (
  "title",
  "subtitle",
  "message",
  "image_url",
  "offer_code",
  "button_text",
  "link_url",
  "display_delay_ms",
  "show_once_session",
  "is_active",
  "sort_order",
  "updated_at"
) VALUES (
  'Summer Style Event',
  'Limited Offer',
  'Enjoy 20% off selected new arrivals. Refresh your wardrobe with clean silhouettes and refined everyday pieces.',
  '/assets/images/banner-01.webp',
  'SUMMER20',
  'Shop the offer',
  '/category/all',
  900,
  true,
  true,
  0,
  CURRENT_TIMESTAMP
);
