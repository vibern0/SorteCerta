import assert from "node:assert/strict";
import test from "node:test";

import { claimApprovedAccess, readAccessStatus, registerWaitlistInterest } from "../worker/access.ts";

class MemoryStatement {
  constructor(store, sql) {
    this.store = store;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (this.sql.includes("SELECT")) {
      const [email] = this.values;
      return this.store.get(email) ?? null;
    }
    if (this.sql.includes("INSERT")) {
      const [, email] = this.values;
      if (!this.store.has(email)) {
        this.store.set(email, {
          email_normalized: email,
          approved_at: null,
          wallet_address: null,
          joined_signature: null,
          joined_message: null,
        });
        return { changed: true };
      }
      return { changed: false };
    }
    if (this.sql.includes("UPDATE") && this.sql.includes("joined_signature IS NULL")) {
      const [walletAddress, signature, joinedMessage, email] = this.values;
      const row = this.store.get(email);
      if (!row || row.approved_at === null || row.joined_signature !== null) return { changed: false };
      row.wallet_address = walletAddress;
      row.joined_signature = signature;
      row.joined_message = joinedMessage;
      return { changed: true };
    }
    throw new Error(`Unhandled SQL: ${this.sql}`);
  }

  async run() {
    return this.first();
  }
}

class MemoryD1 {
  constructor(rows = []) {
    this.rows = new Map(rows.map((row) => [row.email_normalized, { ...row }]));
  }

  prepare(sql) {
    return new MemoryStatement(this.rows, sql);
  }
}

test("joining the waitlist creates a pending row without requiring an invitation", async () => {
  const db = new MemoryD1();

  assert.deepEqual(await registerWaitlistInterest(db, " Person@Example.COM ", () => "id-1", () => "now"), {
    ok: true,
    status: "joined",
  });
  assert.equal(db.rows.get("person@example.com").approved_at, null);

  assert.deepEqual(await registerWaitlistInterest(db, "person@example.com", () => "id-2", () => "later"), {
    ok: true,
    status: "already_joined",
  });
  assert.equal(db.rows.size, 1);
});

test("approved access stores the first wallet signature and accepts the same one again", async () => {
  const db = new MemoryD1([
    {
      email_normalized: "person@example.com",
      approved_at: "2026-10-01T10:00:00.000Z",
      wallet_address: null,
      joined_signature: null,
      joined_message: null,
    },
  ]);

  assert.deepEqual(await claimApprovedAccess(db, "person@example.com", "0xabc", "0xsig"), {
    ok: true,
    status: "approved",
  });
  assert.equal(db.rows.get("person@example.com").wallet_address, "0xabc");
  assert.equal(db.rows.get("person@example.com").joined_signature, "0xsig");

  assert.deepEqual(await claimApprovedAccess(db, "person@example.com", "0xabc", "0xsig"), {
    ok: true,
    status: "approved",
  });
});

test("access status reports approval before the client asks for a signature", async () => {
  const db = new MemoryD1([
    {
      email_normalized: "pending@example.com",
      approved_at: null,
      wallet_address: null,
      joined_signature: null,
      joined_message: null,
    },
    {
      email_normalized: "approved@example.com",
      approved_at: "2026-10-01T10:00:00.000Z",
      wallet_address: null,
      joined_signature: null,
      joined_message: null,
    },
  ]);

  assert.deepEqual(await readAccessStatus(db, "missing@example.com"), { ok: false, status: "pending" });
  assert.deepEqual(await readAccessStatus(db, "pending@example.com"), { ok: false, status: "pending" });
  assert.deepEqual(await readAccessStatus(db, "approved@example.com"), { ok: true, status: "approved" });
});

test("unapproved emails and reused approved emails cannot enter the app", async () => {
  const db = new MemoryD1([
    {
      email_normalized: "pending@example.com",
      approved_at: null,
      wallet_address: null,
      joined_signature: null,
      joined_message: null,
    },
    {
      email_normalized: "used@example.com",
      approved_at: "2026-10-01T10:00:00.000Z",
      wallet_address: "0xabc",
      joined_signature: "0xsig",
      joined_message: "i've joined",
    },
  ]);

  assert.deepEqual(await claimApprovedAccess(db, "pending@example.com", "0xabc", "0xsig"), {
    ok: false,
    status: "pending",
  });
  assert.deepEqual(await claimApprovedAccess(db, "missing@example.com", "0xabc", "0xsig"), {
    ok: false,
    status: "pending",
  });
  assert.deepEqual(await claimApprovedAccess(db, "used@example.com", "0xdef", "0xother"), {
    ok: false,
    status: "claimed",
  });
});
