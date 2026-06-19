# AYD Economy Bot

A Discord economy bot built with **Discord.js v14** and **SQLite**. Players earn, spend, and compete using **AYD** (₳) — with gambling, businesses, loans, heists, citizenship upkeep, and government treasury controls.

## Quick Start

1. **Install dependencies**
  ```bash
   npm install
  ```
2. **Create `.env`** in the project root:
  ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   GUILD_ID=your_guild_id_here   # optional, used by delete-commands.js
  ```
3. **Register slash commandsa**
  ```bash
   npm run deploy
  ```
4. **Start the bot**
  ```bash
   npm start
  ```

New players are created automatically on first interaction and start with **₳2,500**.

---

## Commands

### Wallet & Stats


| Command                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `/balance [user]`      | View balance, lifetime earnings, and credit score  |
| `/leaderboard [limit]` | Top players by balance (default 10, max 25)        |
| `/economy`             | Total money supply, treasury balance, and tax rate |


### Gambling


| Command                   | Description                                         |
| ------------------------- | --------------------------------------------------- |
| `/gamble <amount>`        | Coin flip — 45% win for 2× payout (10s cooldown)    |
| `/dice <amount> <number>` | Guess 1–6 — ~16.7% win for 5× payout (15s cooldown) |
| `/blackjack <amount>`     | Play blackjack against the dealer (30s cooldown)    |


All gambling commands share a bet cap:

```
maxBet = min(balance × 0.25, lifetime_earnings × 0.25)
```

Wins are paid from the national treasury. If the treasury cannot cover a payout, the bet is rejected.

### Businesses


| Command                  | Description                                             |
| ------------------------ | ------------------------------------------------------- |
| `/business buy <type>`   | Purchase a business (cost scales with duplicates owned) |
| `/business collect`      | Collect income from ready businesses (5% tax)           |
| `/business upgrade <id>` | Upgrade a business for higher income                    |
| `/business list`         | View owned businesses and collection timers             |


See [Business Types](#business-types) below for costs and income.

### Loans


| Command                          | Description                                                |
| -------------------------------- | ---------------------------------------------------------- |
| `/loan request <amount>`         | Request a loan (citizens only; requires director approval) |
| `/loan repay <loan_id> <amount>` | Repay an active loan                                       |
| `/loan list`                     | View your active loans                                     |
| `/loan pending`                  | **Directors only** — view pending requests                 |
| `/loan accept <loan_id>`         | **Directors only** — approve and disburse a loan           |


### PvP


| Command           | Description                                         |
| ----------------- | --------------------------------------------------- |
| `/heist <target>` | Attempt to steal from another player (60s cooldown) |


- Requires at least **₳100** to attempt; target must hold at least **₳500**
- Success chance starts at **40%**, reduced by the target's credit score (minimum **10%**)
- On success: steal **10–30%** of the target's wallet
- On failure: pay a fine of **5–15%** of your wallet to the treasury

### Citizenship


| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `/upkeep pay`    | Pay upkeep to maintain citizen status    |
| `/upkeep status` | View citizen status and next payment due |


Upkeep cost: `floor(balance × 0.01 + 100)`. Must be paid every **48 hours**.

### Government & Treasury


| Command                              | Description                       | Access                        |
| ------------------------------------ | --------------------------------- | ----------------------------- |
| `/print <amount>`                    | Mint AYD into the national bank   | Directors of National Bank    |
| `/burn <amount>`                     | Remove AYD from the national bank | Directors of National Bank    |
| `/treasury balance`                  | View treasury balance             | Everyone                      |
| `/treasury transfer <user> <amount>` | Send treasury funds to a player   | National Regional Coordinator |


---

## Economy Rules

### Treasury

- Starting treasury balance: **₳1,000,000**
- **Inflows:** gambling losses, heist fines, business taxes, upkeep payments, loan repayments
- **Outflows:** gambling wins, loan disbursements

### Taxes

- Business income is taxed at **5%** on collection
- Taxes are routed to the national treasury

### Citizenship

Citizens have full access to loans and full business income. Non-citizens:

- Cannot request loans
- Earn **25% less** business income
- Cannot run for government (reserved for future features)

Paying upkeep assigns the citizen Discord role automatically.

### Loans


| Rule       | Value                                           |
| ---------- | ----------------------------------------------- |
| Interest   | 10%                                             |
| Term       | 7 days                                          |
| Max amount | `floor(balance × credit_score / 1000)`          |
| Approval   | Director must accept before funds are disbursed |


### Credit Score


| Rule                      | Value                 |
| ------------------------- | --------------------- |
| Range                     | 300–850 (default 600) |
| On-time full repayment    | +10                   |
| Late full repayment       | −20                   |
| On-time partial repayment | +5                    |
| Late partial repayment    | −10                   |


Credit score affects loan limits and heist success chance against you.

### Business Scaling

**Purchase cost** (per type owned):

```
finalCost = floor(baseCost × 1.4^ownedCount)
```

**Income per collection:**

```
income = baseIncome × (1 + 0.5 × (level − 1)) × duplicatePenalty
duplicatePenalty = max(1 − (sameTypeCount − 1) × 0.05, 0.5)
```

**Upgrade cost:**

```
upgradeCost = floor(baseCost × level^1.5)
```

---

## Business Types


| Business          | Base Cost | Base Income | Cooldown |
| ----------------- | --------- | ----------- | -------- |
| 🍋 Lemonade Stand | ₳1,000    | ₳50         | 10 min   |
| 🍔 Food Truck     | ₳5,000    | ₳200        | 20 min   |
| 🏪 Retail Shop    | ₳20,000   | ₳800        | 30 min   |
| 🏭 Factory        | ₳100,000  | ₳5,000      | 1 hour   |


---

## Configuration

### Environment Variables


| Variable        | Required | Description                                       |
| --------------- | -------- | ------------------------------------------------- |
| `DISCORD_TOKEN` | Yes      | Discord bot token                                 |
| `CLIENT_ID`     | Yes      | Application ID (for command deployment)           |
| `GUILD_ID`      | No       | Guild ID used when clearing guild-scoped commands |


### Discord Roles

The bot checks role **names** (not IDs) for government commands:


| Role Name                     | Commands                                           |
| ----------------------------- | -------------------------------------------------- |
| Directors of National Bank    | `/print`, `/burn`, `/loan pending`, `/loan accept` |
| National Regional Coordinator | `/treasury transfer`                               |


Citizen status uses a hardcoded role ID in `commands/upkeep.js`. Update it if deploying to a different server.

---

## Development

### Project Structure

```
├── index.js                 # Bot entry point
├── deploy-commands.js         # Register slash commands globally
├── delete-commands.js         # Remove all slash commands
├── package.json
├── database/
│   ├── db.js                # SQLite schema and connection
│   └── economy.js           # Balance, loans, upkeep, treasury helpers
└── commands/
    ├── balance.js
    ├── blackjack.js
    ├── business.js
    ├── burn.js
    ├── dice.js
    ├── economy.js
    ├── gamble.js
    ├── heist.js
    ├── leaderboard.js
    ├── loan.js
    ├── print.js
    ├── treasury.js
    └── upkeep.js
```

### Adding a Command

1. Create a new file in `commands/` exporting `data` (SlashCommandBuilder) and `execute`
2. Run `npm run deploy` to register it with Discord

Commands are loaded automatically from the `commands/` folder — no changes to `index.js` needed.

### Database

SQLite database file: `database/economy.db` (created on first run)


| Table           | Purpose                                           |
| --------------- | ------------------------------------------------- |
| `users`         | Balances, upkeep, credit score, lifetime earnings |
| `businesses`    | Owned businesses and collection state             |
| `loans`         | Loan requests, status, and repayment              |
| `cooldowns`     | Per-command cooldown tracking                     |
| `national_bank` | Treasury balance                                  |


### Scripts

```bash
npm start          # Run the bot
npm run deploy     # Register slash commands
npm run delete     # Remove all slash commands
```

---

## License

MIT