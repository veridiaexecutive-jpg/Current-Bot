const db = require("./db");

// Ensure user exists in database
function ensureUser(userId) {
  const exists = db.prepare("SELECT id FROM users WHERE id = ?").get(userId);
  if (!exists) {
    db.prepare("INSERT INTO users (id, balance, lifetime_earnings) VALUES (?, 2500, 2500)").run(userId);
  }
}

// Get user balance
function getBalance(userId) {
  ensureUser(userId);
  const user = db.prepare("SELECT balance FROM users WHERE id = ?").get(userId);
  return user?.balance || 0;
}

// Update balance
function updateBalance(userId, amount) {
  ensureUser(userId);
  db.prepare("UPDATE users SET balance = balance + ? WHERE id = ?").run(amount, userId);
}

// Set balance
function setBalance(userId, amount) {
  ensureUser(userId);
  db.prepare("UPDATE users SET balance = ? WHERE id = ?").run(Math.max(0, amount), userId);
}

// Check and apply cooldown
function getCooldownSeconds(userId, command) {
  const cooldown = db.prepare(
    "SELECT expires_at FROM cooldowns WHERE user_id = ? AND command = ?"
  ).get(userId, command);

  if (!cooldown) return 0;

  const now = Math.floor(Date.now() / 1000);
  const remaining = cooldown.expires_at - now;

  return Math.max(0, remaining);
}

// Set cooldown
function setCooldown(userId, command, seconds) {
  const expiresAt = Math.floor(Date.now() / 1000) + seconds;
  db.prepare(
    "INSERT OR REPLACE INTO cooldowns (user_id, command, expires_at) VALUES (?, ?, ?)"
  ).run(userId, command, expiresAt);
}

// Tax calculation
function calculateTax(amount) {
  return Math.floor(amount * 0.05); // 5% tax
}

// Get user last upkeep timestamp
function getLastUpkeep(userId) {
  ensureUser(userId);
  const user = db.prepare("SELECT last_upkeep FROM users WHERE id = ?").get(userId);
  return user?.last_upkeep || 0;
}

// Set user last upkeep timestamp
function setLastUpkeep(userId, timestamp) {
  ensureUser(userId);
  db.prepare("UPDATE users SET last_upkeep = ? WHERE id = ?").run(timestamp, userId);
}

// Get user credit score
function getCreditScore(userId) {
  ensureUser(userId);
  const user = db.prepare("SELECT credit_score FROM users WHERE id = ?").get(userId);
  return user?.credit_score || 600;
}

// Update credit score
function updateCreditScore(userId, amount) {
  ensureUser(userId);
  const newScore = Math.max(300, Math.min(850, getCreditScore(userId) + amount));
  db.prepare("UPDATE users SET credit_score = ? WHERE id = ?").run(newScore, userId);
}

// Get total tax paid
function getTotalTaxPaid(userId) {
  ensureUser(userId);
  const user = db.prepare("SELECT total_tax_paid FROM users WHERE id = ?").get(userId);
  return user?.total_tax_paid || 0;
}

// Update total tax paid
function updateTotalTaxPaid(userId, amount) {
  ensureUser(userId);
  db.prepare("UPDATE users SET total_tax_paid = total_tax_paid + ? WHERE id = ?").run(amount, userId);
}

// Get lifetime earnings
function getLifetimeEarnings(userId) {
  ensureUser(userId);
  const user = db.prepare("SELECT lifetime_earnings FROM users WHERE id = ?").get(userId);
  return user?.lifetime_earnings || 0;
}

// Update lifetime earnings
function updateLifetimeEarnings(userId, amount) {
  ensureUser(userId);
  db.prepare("UPDATE users SET lifetime_earnings = lifetime_earnings + ? WHERE id = ?").run(amount, userId);
}

// Get total money supply
function getTotalMoneySupply() {
  const userSupply = db.prepare("SELECT SUM(balance) AS total FROM users").get();
  const treasury = getGovernmentBalance();
  return Math.floor((userSupply?.total || 0) + treasury);
}

// Get tax rate
function getTaxRate() {
  return 0.05;
}

// Calculate upkeep cost
function calculateUpkeepCost(userId) {
  const balance = getBalance(userId);
  return Math.floor((balance * 0.01) + 100);
}

// Check if user is a citizen (paid upkeep within 48 hours)
function isCitizen(userId) {
  const lastUpkeep = getLastUpkeep(userId);
  return (Date.now() - lastUpkeep) < 48 * 60 * 60 * 1000;
}

// Pay upkeep
function payUpkeep(userId) {
  const cost = calculateUpkeepCost(userId);
  const balance = getBalance(userId);
  
  if (balance < cost) {
    return false; // Not enough money
  }
  
  updateBalance(userId, -cost);
  updateGovernmentBalance(cost);
  setLastUpkeep(userId, Date.now());
  updateTotalTaxPaid(userId, cost);
  return true;
}

// Get government balance
function getGovernmentBalance() {
  const gov = db.prepare("SELECT balance FROM national_bank").get();
  return gov?.balance || 0;
}

// Update government balance
function updateGovernmentBalance(amount) {
  db.prepare("UPDATE national_bank SET balance = balance + ?").run(amount);
}

// Get active loans for user
function getUserLoans(userId) {
  return db.prepare(
    "SELECT * FROM loans WHERE user_id = ? AND status = 'accepted' AND paid_off = 0 ORDER BY due_date"
  ).all(userId);
}

// Get pending loans (for directors to review)
function getPendingLoans() {
  return db.prepare(
    "SELECT * FROM loans WHERE status = 'pending' ORDER BY created_at"
  ).all();
}

// Get a specific loan
function getLoan(loanId) {
  return db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId);
}

// Create a new loan (starts as pending)
function createLoan(userId, amount) {
  const interestRate = 0.10; // 10% interest
  const amountOwed = Math.floor(amount * (1 + interestRate));
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7); // 7 day loan

  db.prepare(`
    INSERT INTO loans (user_id, amount, interest_rate, amount_owed, status, due_date)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `).run(userId, amount, interestRate, amountOwed, dueDate.toISOString());

  const loan = db.prepare("SELECT id FROM loans WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId);
  return loan.id;
}

// Accept a pending loan (director action)
function acceptLoan(loanId) {
  db.prepare("UPDATE loans SET status = 'accepted' WHERE id = ? AND status = 'pending'").run(loanId);
}

// Reject a pending loan (director action)
function rejectLoan(loanId) {
  db.prepare("UPDATE loans SET status = 'rejected' WHERE id = ? AND status = 'pending'").run(loanId);
}

// Repay a loan
function repayLoan(loanId, amount) {
  const loan = db.prepare("SELECT * FROM loans WHERE id = ?").get(loanId);
  if (!loan) return false;

  const remaining = loan.amount_owed - amount;
  const now = new Date();
  const dueDate = new Date(loan.due_date);
  const isOnTime = now <= dueDate;
  
  if (remaining <= 0) {
    db.prepare("UPDATE loans SET paid_off = 1 WHERE id = ?").run(loanId);
    // Full repayment
    updateCreditScore(loan.user_id, isOnTime ? 10 : -20);
  } else {
    db.prepare("UPDATE loans SET amount_owed = amount_owed - ? WHERE id = ?").run(amount, loanId);
    // Partial repayment - smaller credit adjustment
    updateCreditScore(loan.user_id, isOnTime ? 5 : -10);
  }

  return true;
}

module.exports = {
  db,
  ensureUser,
  getBalance,
  updateBalance,
  setBalance,
  getCooldownSeconds,
  setCooldown,
  calculateTax,
  getGovernmentBalance,
  updateGovernmentBalance,
  getUserLoans,
  getPendingLoans,
  createLoan,
  acceptLoan,
  rejectLoan,
  repayLoan,
  getLoan,
  getLastUpkeep,
  setLastUpkeep,
  getCreditScore,
  updateCreditScore,
  getTotalTaxPaid,
  updateTotalTaxPaid,
  getLifetimeEarnings,
  updateLifetimeEarnings,
  getTotalMoneySupply,
  getTaxRate,
  calculateUpkeepCost,
  isCitizen,
  payUpkeep,
};
