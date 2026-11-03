CREATE TABLE `analysis_sheet` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`analyzed_at` text NOT NULL,
	`lab` text NOT NULL,
	`source_name` text NOT NULL,
	`spring_type` text NOT NULL,
	`data` text NOT NULL,
	`needs_verification` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `daily_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`temp_c` real,
	`point` text NOT NULL,
	`flow_level` text NOT NULL,
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
CREATE TABLE `detection` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`daily_log_id` integer NOT NULL,
	`level` text NOT NULL,
	`reasons` text NOT NULL,
	`next_checks` text NOT NULL,
	`explanation_pro` text NOT NULL,
	`explanation_guest` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`daily_log_id`) REFERENCES `daily_log`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `facility` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`onsen_area_id` integer NOT NULL,
	`name` text NOT NULL,
	`has_ai_yumori` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`onsen_area_id`) REFERENCES `onsen_area`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goyuin` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`onsen_area_id` integer NOT NULL,
	`obtained_via` text NOT NULL,
	`obtained_at` integer NOT NULL,
	`snapshot` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`onsen_area_id`) REFERENCES `onsen_area`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `handover_note` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`facility_id` integer NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`body_md` text NOT NULL,
	`model` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`facility_id`) REFERENCES `facility`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `onsen_area` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`prefecture` text NOT NULL,
	`name` text NOT NULL,
	`reading` text NOT NULL,
	`spring_type` text NOT NULL,
	`spring_type_class` text NOT NULL,
	`why_famous` text NOT NULL,
	`character_image` text,
	`source_url` text,
	`source_status` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `onsen_area_code_unique` ON `onsen_area` (`code`);