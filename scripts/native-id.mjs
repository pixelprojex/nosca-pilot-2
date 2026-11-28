/* THE APP'S ID IN THE STORES — one value, written everywhere the native
 * projects carry it.
 *
 * Run: npm run native:id -- ie.nosca.app
 *
 * It is appId in capacitor.config.json, and `npx cap add` copied it into
 * the iOS target's PRODUCT_BUNDLE_IDENTIFIER (Debug and Release) and
 * Android's applicationId and strings, and codemagic.yaml signs for it;
 * this writes the new one into all of them. Android's namespace — the
 * Java package MainActivity lives in — is code, not the id a store knows,
 * and stays. Once the app is in a store its id can never change: set it
 * before the first upload (docs/native/README.md).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const next = process.argv[2];
/* what both stores take: letters and digits, dotted, each part starting with a letter */
if (!next || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(next)) {
  console.error("Usage: npm run native:id -- ie.nosca.app (letters and digits in two or more dotted parts, each starting with a letter)");
  process.exit(1);
}
const config = join(ROOT, "capacitor.config.json");
const was = JSON.parse(readFileSync(config, "utf8")).appId;
const edit = (path, change) => {
  const file = join(ROOT, path);
  const before = readFileSync(file, "utf8");
  const after = change(before);
  if (after === before) { console.log("unchanged", path); return; }
  writeFileSync(file, after);
  console.log("wrote", path);
};
const quoted = (s) => s.replace(/[.]/g, "\\.");
edit("capacitor.config.json", (s) => s.replace(/"appId":\s*"[^"]*"/, `"appId": "${next}"`));
edit("ios/App/App.xcodeproj/project.pbxproj", (s) => s.replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${next};`));
edit("android/app/build.gradle", (s) => s.replace(/applicationId "[^"]*"/, `applicationId "${next}"`));
edit("codemagic.yaml", (s) => s.replace(/bundle_identifier: \S+/, `bundle_identifier: ${next}`));
edit("android/app/src/main/res/values/strings.xml", (s) => s
  .replace(new RegExp(`(<string name="package_name">)${quoted(was)}(</string>)`), `$1${next}$2`)
  .replace(new RegExp(`(<string name="custom_url_scheme">)${quoted(was)}(</string>)`), `$1${next}$2`));
console.log(`${was} → ${next}. Run npm run native:sync, then commit.`);
