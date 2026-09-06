// Run locally with Node.js (NOT inside Cloudflare) to generate the SQL
// needed to create your first admin login.
//
// Usage:
//   node scripts/create-admin.js <username> <password>
//
// It prints an INSERT statement — run it against your D1 database with:
//   wrangler d1 execute rose-arsham-db --command "PASTE_THE_PRINTED_SQL_HERE"
// or save it to a .sql file and use --file=.

const crypto = require("crypto");

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error("Usage: node scripts/create-admin.js <username> <password>");
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");

const sql = `INSERT INTO admin_users (username, password_hash, salt) VALUES ('${username}', '${hash}', '${salt}');`;

console.log("\nRun this against your D1 database:\n");
console.log(sql);
console.log("\n(keep the password somewhere safe — this script does not store it)\n");
