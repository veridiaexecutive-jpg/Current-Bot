const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getGovernmentBalance, updateGovernmentBalance, getBalance, updateBalance, ensureUser } = require("../database/economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("treasury")
    .setDescription("National treasury management")
    .addSubcommand(subcommand =>
      subcommand
        .setName("balance")
        .setDescription("Check the national treasury balance")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("transfer")
        .setDescription("(National Regional Coordinator only) Transfer money from treasury to a user")
        .addUserOption(option =>
          option
            .setName("user")
            .setDescription("User to transfer money to")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("amount")
            .setDescription("Amount to transfer")
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "balance") {
      await handleBalance(interaction);
    } else if (subcommand === "transfer") {
      await handleTransfer(interaction, userId);
    }
  }
};

async function handleBalance(interaction) {
  const treasuryBalance = getGovernmentBalance();

  const embed = new EmbedBuilder()
    .setTitle("🏛️ National Treasury")
    .setColor("#FFD700")
    .addFields(
      { name: "Treasury Balance", value: `₳${treasuryBalance}`, inline: true },
      { name: "Source", value: "Taxes, Fines, Government Printing", inline: false }
    )
    .setFooter({ text: "Treasury funds support the national economy" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleTransfer(interaction, userId) {
  // Check if user is a National Regional Coordinator
  const hasCoordinatorRole = interaction.member.roles.cache.some(
    role => role.name === "National Regional Coordinator"
  );

  if (!hasCoordinatorRole) {
    return interaction.editReply({
      content: "❌ You must be a **National Regional Coordinator** to transfer treasury funds.",
      flags: 64,
    });
  }

  const targetUser = interaction.options.getUser("user");
  const targetId = targetUser.id;
  const amount = interaction.options.getInteger("amount");

  if (amount <= 0) {
    return interaction.editReply({
      content: "❌ Transfer amount must be positive.",
      flags: 64,
    });
  }

  const treasuryBalance = getGovernmentBalance();

  if (treasuryBalance < amount) {
    return interaction.editReply({
      content: `❌ Treasury doesn't have enough funds. Balance: ₳${treasuryBalance}`,
      flags: 64,
    });
  }

  ensureUser(targetId);

  // Transfer from treasury to user
  updateGovernmentBalance(-amount);
  updateBalance(targetId, amount);

  const newTreasuryBalance = getGovernmentBalance();
  const newTargetBalance = getBalance(targetId);

  const embed = new EmbedBuilder()
    .setTitle("💸 Treasury Transfer")
    .setColor("#00AA00")
    .addFields(
      { name: "Recipient", value: `<@${targetId}>`, inline: true },
      { name: "Amount Transferred", value: `₳${amount}`, inline: true },
      { name: "Treasury Balance", value: `₳${newTreasuryBalance}`, inline: false },
      { name: `${targetUser.username}'s Balance`, value: `₳${newTargetBalance}`, inline: false }
    )
    .setFooter({ text: "Transfer completed by government directive" });

  await interaction.editReply({ embeds: [embed] });
}