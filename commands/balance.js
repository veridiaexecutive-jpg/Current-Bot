const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBalance, getLifetimeEarnings, getCreditScore } = require("../database/economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check your AYD balance")
    .addUserOption(option =>
      option
        .setName("user")
        .setDescription("Check another user's balance")
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const balance = getBalance(targetUser.id);
    const lifetimeEarnings = getLifetimeEarnings(targetUser.id);
    const creditScore = getCreditScore(targetUser.id);

    const embed = new EmbedBuilder()
      .setTitle(`💰 ${targetUser.username}'s Balance`)
      .setColor("#FFD700")
      .addFields(
        { name: "Balance", value: `₳${balance.toLocaleString()}`, inline: true },
        { name: "Lifetime Earnings", value: `₳${lifetimeEarnings.toLocaleString()}`, inline: true },
        { name: "Credit Score", value: `${creditScore}`, inline: true }
      )
      .setThumbnail(targetUser.displayAvatarURL())
      .setFooter({ text: "AYD — the official currency" });

    await interaction.reply({ embeds: [embed] });
  }
};
