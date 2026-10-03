PRAGMA foreign_keys = off;

CREATE TABLE waitlist_entries_new (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  joined_at TEXT NOT NULL,
  approved_at TEXT,
  wallet_address TEXT UNIQUE,
  joined_message TEXT,
  joined_signature TEXT,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  referral_code TEXT,
  referrer_host TEXT
);

INSERT OR IGNORE INTO waitlist_entries_new (
  id,
  email_normalized,
  joined_at,
  source,
  medium,
  campaign,
  referral_code,
  referrer_host
)
SELECT
  id,
  email_normalized,
  joined_at,
  source,
  medium,
  campaign,
  referral_code,
  referrer_host
FROM waitlist_entries;

DROP TABLE waitlist_entries;
DROP TABLE invitations;

ALTER TABLE waitlist_entries_new RENAME TO waitlist_entries;

CREATE INDEX waitlist_entries_approved_idx ON waitlist_entries(approved_at);

PRAGMA foreign_keys = on;
