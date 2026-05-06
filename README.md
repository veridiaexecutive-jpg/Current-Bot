# AYD Economy Bot

A comprehensive Discord bot featuring a full economy system with gambling, businesses, loans, taxes, government controls, and more. Built with Discord.js and SQLite.

## Features

### 🎲 Gambling Commands
- **`/gamble <amount>`** - Coin flip (45% win/55% lose for 2x payout)
- **`/dice <amount> <number>`** - Roll dice 1-6 (16.7% win for 5x payout)
- **`/blackjack <amount>`** - Play blackjack against the dealer

### 🏢 Business System
- **`/business buy <type>`** - Purchase businesses (Lemonade Stand, Food Truck, Retail Shop, Factory)
- **`/business collect`** - Collect income from ready businesses with 5% tax
- **`/business upgrade <id>`** - Upgrade a business for more income
- **`/business list`** - List your businesses and status

### 💰 Loan System
- **`/loan request <amount>`** - Request a loan from the national bank
- **`/loan repay <loan_id> <amount>`** - Repay a loan
- **`/loan list`** - View your active loans
- **`/loan pending`** - **(Directors only)** View pending loan requests
- **`/loan accept <loan_id>`** - **(Directors only)** Approve a request

### 🕵️ PvP System
- **`/heist <target>`** - Attempt to steal from another player

### 🏛️ Government & Treasury
- **`/print <amount>`** - Print new AYD into the national bank
- **`/burn <amount>`** - Burn AYD from the national bank
- **`/treasury balance`** - View treasury balance
- **`/treasury transfer <user> <amount>`** - Transfer treasury funds (National Regional Coordinator only)

### 🆔 Citizenship & Upkeep
- **`/upkeep pay`** - Pay upkeep to stay a citizen
- **`/upkeep status`** - View your upkeep status and next payment

### 📊 Economy Stats
- **`/economy`** - View total money supply, treasury balance, tax rate, and inflation status
- **`/leaderboard [limit]`** - See the top players by balance

## Installation

### Prerequisites
- Node.js 16.0 or higher
- npm or yarn
- A Discord bot token

### Setup Steps

1. Clone or download this project.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_client_id_here
   GUILD_ID=your_guild_id_here # optional for testing
   ```
4. Deploy slash commands:
   ```bash
   npm run deploy
   ```
5. Start the bot:
   ```bash
   npm start
   ```

## Configuration

### .env Variables
- `DISCORD_TOKEN` - Your Discord bot token
- `CLIENT_ID` - Your bot's application ID
- `GUILD_ID` - Optional server ID for testing commands

### Admin Roles
- **Directors of National Bank** — required for `/print`, `/burn`, `/loan pending`, and `/loan accept`
- **National Regional Coordinator** — required for `/treasury transfer`

## Economy Rules

### Starting Resources
- New players start with **₳2,500**

### Anti-Abuse
- Gambling bet cap uses both current balance and lifetime earnings:
  - `maxBet = min(balance * 0.25, lifetime_earnings * 0.25)`
- Gambling commands have cooldowns

### Taxes & Treasury
- Business income is taxed at **5%**
- Taxes and fines go into the national treasury
- Treasury funds pay gambling wins, blackjack payouts, and loan disbursements

### Citizenship
- Upkeep must be paid every 48 hours
- Non-citizens:
  - cannot request loans
  - cannot run for government
  - receive **25% less business income**

### Loans
- Interest rate: **10%**
- Repayment term: **7 days**
- Loan maximum is based on credit score, not a fixed percentage
- Director approval is required before disbursement

### Credit Score
- Range: **300–850**
- Default: **600**
- On-time loan repayment: **+10**
- Late or unpaid loans: **-20**
- Affects loan access and heist protection

### Business Costs
- Buying the same business type multiple times gets progressively more expensive:
  - `finalCost = floor(baseCost * 1.4^ownedCount)`
- Businesses are stackable, but scaling makes late-game buying strategic

## Business Types

| Business | Base Cost | Base Income | Cooldown |
|----------|-----------|-------------|----------|
| Lemonade Stand | ₳1,000 | ₳50 | 10 min |
| Food Truck | ₳5,000 | ₳200 | 20 min |
| Retail Shop | ₳20,000 | ₳800 | 30 min |
| Factory | ₳100,000 | ₳5,000 | 1 hour |

## Database

Database file: `database/economy.db`

### Key Tables
- `users` — balances, upkeep, credit score, taxes, lifetime earnings
- `businesses` — user-owned businesses
- `loans` — loan requests and repayment status
- `cooldowns` — command cooldown tracking
- `national_bank` — treasury balance

## Commands

### Deploying Commands
```bash
npm run deploy
```

### Deleting Commands
```bash
npm run delete
```

## Development

### Project Structure
```
├── index.js
├── deploy-commands.js
├── delete-commands.js
├── package.json
├── .env
├── database/
│   ├── db.js
│   └── economy.js
└── commands/
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

### Adding New Commands
1. Create a new file in `commands/`
2. Export a command object with `data` and `execute`
3. Run `npm run deploy`

## Economy Balance

Initial treasury balance: **₳1,000,000**

Government balance changes from:
- **Increases:** gambling losses, failed heists, business taxes, loan repayments
- **Decreases:** gambling wins, dice wins, blackjack payouts, loan approvals

## Support

For issues or questions, review the commands folder or inspect the economy helpers in `database/economy.js`.

## License

MIT
