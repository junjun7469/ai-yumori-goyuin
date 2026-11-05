CREATE TABLE `onsen_personality` (
	`code` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`citation` text NOT NULL,
	`kind` text NOT NULL,
	`models` text NOT NULL,
	`rewrites` integer DEFAULT 0 NOT NULL,
	`log` text NOT NULL,
	`cost_usd` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
