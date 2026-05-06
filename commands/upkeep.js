const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBalance, calculateUpkeepCost, isCitizen, payUpkeep, getLastUpkeep } = require("../database/economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("upkeep")
    .setDescription("Manage your citizen upkeep")
    .addSubcommand(subcommand =>
      subcommand
        .setName("pay")
        .setDescription("Pay your citizen upkeep fee")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("status")
        .setDescription("Check your citizen status")
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "pay") {
      await handlePay(interaction, userId);
    } else if (subcommand === "status") {
      await handleStatus(interaction, userId);
    }
  }
};

async function handlePay(interaction, userId) {
  const balance = getBalance(userId);
  const upkeepCost = calculateUpkeepCost(userId);

  if (balance < upkeepCost) {
    return interaction.reply({
      content: `❌ You need **₳${upkeepCost}** to pay upkeep. You have **₳${balance}**.`,
      ephemeral: true,
    });
  }

  const success = payUpkeep(userId);
  if (!success) {
    return interaction.reply({
      content: "❌ Failed to pay upkeep. Please try again.",
      ephemeral: true,
    });
  }

  const newBalance = getBalance(userId);
  const citizen = isCitizen(userId);

  const embed = new EmbedBuilder()
    .setTitle("✅ Upkeep Paid")
    .setColor("#00AA00")
    .addFields(
      { name: "Cost", value: `₳${upkeepCost}`, inline: true },
      { name: "Your Balance", value: `₳${newBalance}`, inline: true },
      { name: "Citizen Status", value: citizen ? "🟢 Active" : "🔴 Inactive", inline: true }
    )
    .setFooter({ text: "Upkeep must be paid every 48 hours to remain a citizen" });

  await interaction.reply({ embeds: [embed] });
}

async function handleStatus(interaction, userId) {
  const balance = getBalance(userId);
  const upkeepCost = calculateUpkeepCost(userId);
  const citizen = isCitizen(userId);
  const lastUpkeep = getLastUpkeep(userId);

  let timeUntilExpiry = "";
  if (lastUpkeep > 0) {
    const expiryTime = lastUpkeep + 48 * 60 * 60 * 1000;
    const timeLeft = expiryTime - Date.now();
    if (timeLeft > 0) {
      const hours = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      timeUntilExpiry = `${hours}h ${minutes}m`;
    } else {
      timeUntilExpiry = "Expired";
    }
  } else {
    timeUntilExpiry = "Never paid";
  }

  const embed = new EmbedBuilder()
    .setTitle("🆔 Citizen Status")
    .setColor(citizen ? "#00AA00" : "#AA0000")
    .addFields(
      { name: "Status", value: citizen ? "🟢 Citizen" : "🔴 Non-Citizen", inline: true },
      { name: "Next Payment Due", value: timeUntilExpiry, inline: true },
      { name: "Upkeep Cost", value: `₳${upkeepCost}`, inline: true },
      { name: "Your Balance", value: `₳${balance}`, inline: false }
    )
    .setFooter({ text: citizen ? "You have full access to economy features" : "Pay upkeep to regain citizen privileges" });

  if (!citizen) {
    embed.addFields({
      name: "Restrictions",
      value: "• Cannot request loans\n• Businesses produce 25% less income\n• Cannot run for government",
      inline: false
    });
  }

  await interaction.reply({ embeds: [embed] });
}