const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBalance, updateBalance, ensureUser, isCitizen, updateTotalTaxPaid, updateLifetimeEarnings } = require("../database/economy");
const db = require("../database/db");

const BUSINESS_TYPES = {
  lemonade: {
    name: "Lemonade Stand",
    cost: 1000,
    baseIncome: 50,
    cooldown: 10 * 60, // 10 minutes
    emoji: "🍋",
  },
  food: {
    name: "Food Truck",
    cost: 5000,
    baseIncome: 200,
    cooldown: 20 * 60, // 20 minutes
    emoji: "🍔",
  },
  retail: {
    name: "Retail Shop",
    cost: 20000,
    baseIncome: 800,
    cooldown: 30 * 60, // 30 minutes
    emoji: "🏪",
  },
  factory: {
    name: "Factory",
    cost: 100000,
    baseIncome: 5000,
    cooldown: 60 * 60, // 1 hour
    emoji: "🏭",
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("business")
    .setDescription("Business management commands")
    .addSubcommand(subcommand =>
      subcommand
        .setName("buy")
        .setDescription("Buy a business")
        .addStringOption(option =>
          option
            .setName("type")
            .setDescription("Business type to buy")
            .setRequired(true)
            .addChoices(
              { name: "🍋 Lemonade Stand ($1,000)", value: "lemonade" },
              { name: "🍔 Food Truck ($5,000)", value: "food" },
              { name: "🏪 Retail Shop ($20,000)", value: "retail" },
              { name: "🏭 Factory ($100,000)", value: "factory" }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("collect")
        .setDescription("Collect income from all your ready businesses")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("upgrade")
        .setDescription("Upgrade a business")
        .addIntegerOption(option =>
          option
            .setName("id")
            .setDescription("Business ID to upgrade")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("List all your businesses")
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    ensureUser(userId);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "buy") {
      await handleBuy(interaction, userId);
    } else if (subcommand === "collect") {
      await handleCollect(interaction, userId);
    } else if (subcommand === "upgrade") {
      await handleUpgrade(interaction, userId);
    } else if (subcommand === "list") {
      await handleList(interaction, userId);
    }
  }
};

async function handleBuy(interaction, userId) {
  const type = interaction.options.getString("type");
  const business = BUSINESS_TYPES[type];

  if (!business) {
    return interaction.reply({
      content: "❌ Invalid business type.",
      ephemeral: true,
    });
  }

  const balance = getBalance(userId);
  const ownedCount = db.prepare(
    "SELECT COUNT(*) AS count FROM businesses WHERE owner_id = ? AND type = ?"
  ).get(userId, type).count;
  const finalCost = Math.floor(business.cost * Math.pow(1.4, ownedCount));
  const nextCost = Math.floor(business.cost * Math.pow(1.4, ownedCount + 1));

  if (balance < finalCost) {
    return interaction.reply({
      content: `❌ You need **₳${finalCost}** to buy a **${business.name}**. You have **₳${balance}**.`,
      ephemeral: true,
    });
  }

  // Create business
  db.prepare(`
    INSERT INTO businesses (owner_id, type, level, stored_income, last_collected_at)
    VALUES (?, ?, 1, 0, datetime('now'))
  `).run(userId, type);

  updateBalance(userId, -finalCost);
  const newBalance = getBalance(userId);
  const ownedAfterPurchase = ownedCount + 1;

  const embed = new EmbedBuilder()
    .setTitle(`${business.emoji} Business Purchased`)
    .setColor("#00AA00")
    .setDescription(`You bought a ${business.name} for ₳${finalCost}.`)
    .addFields(
      { name: "Business", value: business.name, inline: true },
      { name: "Cost", value: `₳${finalCost}`, inline: true },
      { name: "You Own", value: `${ownedAfterPurchase}`, inline: true },
      { name: "Next One", value: `₳${nextCost}`, inline: true },
      { name: "Base Income", value: `₳${business.baseIncome}`, inline: true },
      { name: "Cooldown", value: `${business.cooldown / 60} minutes`, inline: true },
      { name: "Your Balance", value: `₳${newBalance}`, inline: false }
    )
    .setFooter({ text: "Use /business list to see all your businesses" });

  await interaction.reply({ embeds: [embed] });
}

async function handleCollect(interaction, userId) {
  const businesses = db.prepare(`
    SELECT id, type, level, stored_income, last_collected_at FROM businesses
    WHERE owner_id = ?
  `).all(userId);

  if (businesses.length === 0) {
    return interaction.reply({
      content: "❌ You don't own any businesses.",
      ephemeral: true,
    });
  }

  let totalCollected = 0;
  const now = Math.floor(Date.now() / 1000);

  for (const biz of businesses) {
    const bizType = BUSINESS_TYPES[biz.type];
    const lastCollected = new Date(biz.last_collected_at).getTime() / 1000;
    const timeSinceCollection = now - lastCollected;

    if (timeSinceCollection >= bizType.cooldown) {
      // Calculate income with level multiplier
      const sameTypeCount = businesses.filter(b => b.type === biz.type).length;
      const incomeMultiplier = Math.max(1 - ((sameTypeCount - 1) * 0.05), 0.5);
      let income = Math.floor(bizType.baseIncome * (1 + 0.5 * (biz.level - 1)) * incomeMultiplier);
      
      // Apply citizen penalty if not a citizen
      if (!isCitizen(userId)) {
        income = Math.floor(income * 0.75);
      }
      
      totalCollected += income;

      // Update database
      db.prepare(`
        UPDATE businesses 
        SET stored_income = 0, last_collected_at = datetime('now')
        WHERE id = ?
      `).run(biz.id);
    }
  }

  if (totalCollected === 0) {
    return interaction.reply({
      content: "❌ No businesses are ready to collect. Check `/business list`.",
      ephemeral: true,
    });
  }

  // Apply tax (5%)
  const tax = Math.floor(totalCollected * 0.05);
  const netIncome = totalCollected - tax;

  updateBalance(userId, netIncome);
  updateTotalTaxPaid(userId, tax);
  updateLifetimeEarnings(userId, netIncome);
  const newBalance = getBalance(userId);

  const embed = new EmbedBuilder()
    .setTitle("💰 Income Collected")
    .setColor("#00AA00")
    .addFields(
      { name: "You Earned", value: `₳${netIncome} (₳${tax} went to taxes)`, inline: true },
      { name: "Tax Rate", value: "5%", inline: true },
      { name: "Your Balance", value: `₳${newBalance}`, inline: false }
    )
    .setFooter({ text: "Taxes support the national treasury!" });

  await interaction.reply({ embeds: [embed] });
}

async function handleUpgrade(interaction, userId) {
  const businessId = interaction.options.getInteger("id");

  const business = db.prepare(`
    SELECT id, type, level, owner_id FROM businesses WHERE id = ? AND owner_id = ?
  `).get(businessId, userId);

  if (!business) {
    return interaction.reply({
      content: "❌ You don't own a business with that ID.",
      ephemeral: true,
    });
  }

  const bizType = BUSINESS_TYPES[business.type];
  const upgradeCost = Math.floor(bizType.cost * Math.pow(business.level, 1.5));
  const balance = getBalance(userId);

  if (balance < upgradeCost) {
    return interaction.reply({
      content: `❌ Upgrade costs **₳${upgradeCost}**. You have **₳${balance}**.`,
      ephemeral: true,
    });
  }

  // Upgrade business
  db.prepare(`
    UPDATE businesses SET level = level + 1 WHERE id = ?
  `).run(businessId);

  updateBalance(userId, -upgradeCost);
  const newBalance = getBalance(userId);

  const newIncome = Math.floor(bizType.baseIncome * (1 + 0.5 * business.level));

  const embed = new EmbedBuilder()
    .setTitle(`${bizType.emoji} Business Upgraded`)
    .setColor("#00AA00")
    .addFields(
      { name: "Business", value: bizType.name, inline: true },
      { name: "Level", value: `${business.level} → ${business.level + 1}`, inline: true },
      { name: "Upgrade Cost", value: `₳${upgradeCost}`, inline: true },
      { name: "New Income", value: `₳${newIncome}`, inline: true },
      { name: "Your Balance", value: `₳${newBalance}`, inline: false }
    );

  await interaction.reply({ embeds: [embed] });
}

async function handleList(interaction, userId) {
  const businesses = db.prepare(`
    SELECT id, type, level, last_collected_at FROM businesses
    WHERE owner_id = ? ORDER BY id
  `).all(userId);

  if (businesses.length === 0) {
    return interaction.reply({
      content: "❌ You don't own any businesses. Use `/business buy` to get started!",
      ephemeral: true,
    });
  }

  const now = Math.floor(Date.now() / 1000);
  let fields = [];

  for (const biz of businesses) {
    const bizType = BUSINESS_TYPES[biz.type];
    const income = Math.floor(bizType.baseIncome * (1 + 0.5 * (biz.level - 1)));
    const lastCollected = new Date(biz.last_collected_at).getTime() / 1000;
    const timeSinceCollection = now - lastCollected;
    const timeRemaining = Math.max(0, bizType.cooldown - timeSinceCollection);

    let status;
    if (timeRemaining === 0) {
      status = "✅ Ready to collect";
    } else {
      const minutes = Math.floor(timeRemaining / 60);
      const seconds = timeRemaining % 60;
      status = `⏳ ${minutes}m ${seconds}s`;
    }

    fields.push({
      name: `${bizType.emoji} ID #${biz.id} - ${bizType.name} (Lvl ${biz.level})`,
      value: `💰 Income: ₳${income}\n${status}`,
      inline: false,
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("📊 Your Businesses")
    .setColor("#0099FF")
    .addFields(...fields)
    .setFooter({ text: "Use /business collect to earn money from ready businesses" });

  await interaction.reply({ embeds: [embed] });
}
