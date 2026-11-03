PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_daily_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`temp_c` real,
	`point` text DEFAULT 'source' NOT NULL,
	`flow_level` text DEFAULT 'normal' NOT NULL,
	`temp_chamber_c` real,
	`temp_bath_c` real,
	`flow_l_per_min` real,
	`clarity` text NOT NULL,
	`smell` text NOT NULL,
	`actions` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`weather` text,
	`is_simulated` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- 旧データの移し替え：温度は測った場所(point)に応じてチャンバー/浴槽へ。
-- 湯量は「目安3段階」を数値に換算できないため NULL にする（推測値を入れない）。
INSERT INTO `__new_daily_log`("id", "facility_id", "logged_at", "temp_c", "point", "flow_level", "temp_chamber_c", "temp_bath_c", "flow_l_per_min", "clarity", "smell", "actions", "note", "weather", "is_simulated", "created_at", "updated_at") SELECT "id", "facility_id", "logged_at", "temp_c", "point", "flow_level", CASE WHEN "point" = 'source' THEN "temp_c" END, CASE WHEN "point" = 'bath' THEN "temp_c" END, NULL, "clarity", "smell", "actions", "note", "weather", "is_simulated", "created_at", "updated_at" FROM `daily_log`;--> statement-breakpoint
DROP TABLE `daily_log`;--> statement-breakpoint
ALTER TABLE `__new_daily_log` RENAME TO `daily_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;