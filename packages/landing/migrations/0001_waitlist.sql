CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  email_normalized TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  redeemed_at TEXT
);
CREATE INDEX invitations_email_idx ON invitations(email_normalized);
CREATE TABLE waitlist_entries (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL UNIQUE,
  email_normalized TEXT NOT NULL UNIQUE,
  joined_at TEXT NOT NULL,
  source TEXT,
  medium TEXT,
  campaign TEXT,
  referral_code TEXT,
  referrer_host TEXT,
  FOREIGN KEY (invitation_id) REFERENCES invitations(id)
);
