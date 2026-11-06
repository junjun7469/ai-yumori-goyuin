CREATE TABLE `bath_gender_map` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`gender` text NOT NULL,
	`bath_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bath_id`) REFERENCES `facility_bath`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bath_gender_map_facility_gender` ON `bath_gender_map` (`facility_id`,`gender`);--> statement-breakpoint
CREATE TABLE `bath_temp_daily` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`day` text NOT NULL,
	`bath_id` integer NOT NULL,
	`temp_c` real NOT NULL,
	`is_simulated` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bath_id`) REFERENCES `facility_bath`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bath_temp_daily_day_bath` ON `bath_temp_daily` (`facility_id`,`day`,`bath_id`);--> statement-breakpoint
CREATE TABLE `bath_voice` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`visited_on` text NOT NULL,
	`gender` text,
	`rating` integer NOT NULL,
	`comment` text DEFAULT '' NOT NULL,
	`is_simulated` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bath_voice_rating_range" CHECK("bath_voice"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX `bath_voice_facility_day` ON `bath_voice` (`facility_id`,`visited_on`);--> statement-breakpoint
CREATE TABLE `facility_bath` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `facility_bath_code` ON `facility_bath` (`facility_id`,`code`);--> statement-breakpoint
CREATE TABLE `voice_comment` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`input` text NOT NULL,
	`output` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON UPDATE no action ON DELETE no action
);
