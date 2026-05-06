const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "economy.db"));

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    balance REAL DEFAULT 2500,
    lifetime_earnings REAL DEFAULT 2500,
    last_upkeep INTEGER DEFAULT 0,
    credit_score INTEGER DEFAULT 600,
    total_tax_paid INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cooldowns (
    user_id TEXT,
    command TEXT,
    expires_at INTEGER,
    PRIMARY KEY (user_id, command),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id TEXT NOT NULL,
    type TEXT NOT NULL,
    level INTEGER DEFAULT 1,
    stored_income REAL DEFAULT 0,
    last_collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS heist_cooldowns (
    user_id TEXT PRIMARY KEY,
    expires_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS national_bank (
    balance REAL DEFAULT 1000000
  );

  CREATE TABLE IF NOT EXISTS loans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    interest_rate REAL DEFAULT 0.10,
    amount_owed REAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date DATETIME NOT NULL,
    paid_off INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Initialize national bank if empty
  INSERT OR IGNORE INTO national_bank (balance) SELECT 1000000 WHERE NOT EXISTS (SELECT 1 FROM national_bank);
`);

const existingUserColumns = db.prepare("PRAGMA table_info(users)").all().map(col => col.name);
if (!existingUserColumns.includes("last_upkeep")) {
  db.prepare("ALTER TABLE users ADD COLUMN last_upkeep INTEGER DEFAULT 0").run();
}
if (!existingUserColumns.includes("credit_score")) {
  db.prepare("ALTER TABLE users ADD COLUMN credit_score INTEGER DEFAULT 600").run();
}
if (!existingUserColumns.includes("total_tax_paid")) {
  db.prepare("ALTER TABLE users ADD COLUMN total_tax_paid INTEGER DEFAULT 0").run();
}
if (!existingUserColumns.includes("lifetime_earnings")) {
  db.prepare("ALTER TABLE users ADD COLUMN lifetime_earnings REAL DEFAULT 2500").run();
}

module.exports = db;
