CREATE TABLE `yunoko` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_key` text NOT NULL,
	`bound_onsen_code` text,
	`visits` integer DEFAULT 0 NOT NULL,
	`stage` integer DEFAULT 0 NOT NULL,
	`born_at` integer NOT NULL,
	`evolved_at` integer,
	`evolved_onsen_code` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
