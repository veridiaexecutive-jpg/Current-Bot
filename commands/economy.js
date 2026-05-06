const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getTotalMoneySupply, getGovernmentBalance, getTaxRate } = require("../database/economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("View the current state of the AYD economy"),

  async execute(interaction) {
    const totalSupply = getTotalMoneySupply();
    const treasuryBalance = getGovernmentBalance();
    const taxRate = getTaxRate() * 100;

    const embed = new EmbedBuilder()
      .setTitle("🌐 Economy Overview")
      .setColor("#00CC99")
      .addFields(
        { name: "Total Money Supply", value: `₳${totalSupply.toLocaleString()}`, inline: true },
        { name: "Treasury Balance", value: `₳${treasuryBalance.toLocaleString()}`, inline: true },
        { name: "Tax Rate", value: `${taxRate}%`, inline: true },
        { name: "Inflation", value: "Not tracked yet", inline: true }
      )
      .setFooter({ text: "Use these metrics to understand the AYD economy." });

    await interaction.reply({ embeds: [embed] });
  }
};