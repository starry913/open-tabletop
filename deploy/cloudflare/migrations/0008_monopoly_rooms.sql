CREATE TABLE `monopoly_limits` (
  `key` text PRIMARY KEY NOT NULL,
  `count` integer NOT NULL,
  `expires_at` integer NOT NULL
);

CREATE TABLE `monopoly_rooms` (
  `code` text PRIMARY KEY NOT NULL,
  `revision` integer DEFAULT 0 NOT NULL,
  `payload` text NOT NULL,
  `expires_at` integer NOT NULL
);

CREATE INDEX `monopoly_rooms_expires_at_idx` ON `monopoly_rooms` (`expires_at`);
