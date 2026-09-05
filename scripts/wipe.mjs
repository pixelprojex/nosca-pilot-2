#!/usr/bin/env node
/* Wipe the pilot — every file, every account, every row.
 *
 * What it does, in order, printing counts as it goes:
 *   1. empties the "media" and "avatars" storage buckets (the buckets
 *      themselves stay, so nothing needs recreating);
 *   2. deletes every auth user — profiles, lessons, bookings, messages,
 *      notifications and everything else cascade away with them;
 *   3. prints what is left, which should be zeros.
 *
 * It cannot be undone. There is no recycle bin. Run it only when the
 * point is to start again from nothing.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service role key> \
 *   node scripts/wipe.mjs --yes
 *
 * The service role key is under Project Settings → API. It bypasses
 * row-level security, which is why this script can see every file and
 * every account — and why that key never goes anywhere near the app.
 */

import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["media", "avatars"];
const BATCH = 100;

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!process.argv.includes("--yes")) {
  console.error("This deletes every account, row and file in the project and cannot be undone.");
  console.error("Run it again with --yes if that is what you want.");
  process.exit(1);
}
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

/* Storage lists one level at a time; an entry without an id is a
   folder, so walk into it. */
async function listAll(bucket, prefix = "") {
  const paths = [];
  const limit = 1000;
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit, offset });
    if (error) throw new Error(`${bucket}: list failed at "${prefix}": ${error.message}`);
    const entries = data || [];
    for (const entry of entries) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) paths.push(path);
      else paths.push(...(await listAll(bucket, path)));
    }
    if (entries.length < limit) break;
    offset += limit;
  }
  return paths;
}

async function bucketExists(bucket) {
  const { error } = await supabase.storage.getBucket(bucket);
  return !error;
}

async function emptyBucket(bucket) {
  if (!(await bucketExists(bucket))) {
    console.log(`bucket "${bucket}": not present, skipped`);
    return;
  }
  const paths = await listAll(bucket);
  console.log(`bucket "${bucket}": ${paths.length} file${paths.length === 1 ? "" : "s"}`);
  let removed = 0;
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH);
    const { error } = await supabase.storage.from(bucket).remove(batch);
    if (error) throw new Error(`${bucket}: remove failed: ${error.message}`);
    removed += batch.length;
    console.log(`  removed ${removed}/${paths.length}`);
  }
}

async function listUsers() {
  const users = [];
  const perPage = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const batch = (data && data.users) || [];
    users.push(...batch);
    if (batch.length < perPage) break;
  }
  return users;
}

async function deleteUsers() {
  const users = await listUsers();
  console.log(`accounts: ${users.length}`);
  let deleted = 0;
  let failed = 0;
  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      failed++;
      console.error(`  could not delete ${user.email || user.id}: ${error.message}`);
    } else {
      deleted++;
      console.log(`  deleted ${user.email || user.id} (${deleted}/${users.length})`);
    }
  }
  if (failed) console.error(`  ${failed} account${failed === 1 ? "" : "s"} could not be deleted`);
}

async function countRows(table) {
  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
  if (error) return `? (${error.message})`;
  return count;
}

async function remaining() {
  console.log("\nremaining:");
  const users = await listUsers();
  console.log(`  auth users: ${users.length}`);
  console.log(`  profiles:   ${await countRows("profiles")}`);
  for (const bucket of BUCKETS) {
    if (!(await bucketExists(bucket))) continue;
    const paths = await listAll(bucket);
    console.log(`  ${bucket}: ${paths.length} file${paths.length === 1 ? "" : "s"}`);
  }
}

try {
  for (const bucket of BUCKETS) await emptyBucket(bucket);
  await deleteUsers();
  await remaining();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
