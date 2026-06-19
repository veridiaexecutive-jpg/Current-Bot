const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const db = require("../database/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the top players by balance")
    .addIntegerOption(option =>
      option
        .setName("limit")
        .setDescription("Number of players to show (default: 10, max: 25)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)
    ),

  async execute(interaction) {
    const limit = interaction.options.getInteger("limit") || 10;

    // Get top players by balance
    const topPlayers = db.prepare(`
      SELECT id, balance
      FROM users
      WHERE balance > 0
      ORDER BY balance DESC
      LIMIT ?
    `).all(limit);

    if (topPlayers.length === 0) {
      return interaction.editReply({
        content: "❌ No players found with balances.",
        flags: 64,
      });
    }

    // Get usernames for each player
    const leaderboardFields = [];
    let rank = 1;

    for (const player of topPlayers) {
      try {
        // Try to get the user from Discord
        const user = await interaction.client.users.fetch(player.id);
        const username = user.username;

        leaderboardFields.push({
          name: `#${rank} ${username}`,
          value: `₳${player.balance.toLocaleString()}`,
          inline: false,
        });
      } catch (error) {
        // If user can't be fetched, show their ID
        leaderboardFields.push({
          name: `#${rank} Unknown User`,
          value: `₳${player.balance.toLocaleString()} (ID: ${player.id})`,
          inline: false,
        });
      }
      rank++;
    }

    const embed = new EmbedBuilder()
      .setTitle("🏆 Balance Leaderboard")
      .setColor("#FFD700")
      .setDescription(`Top ${topPlayers.length} players by AYD balance`)
      .addFields(...leaderboardFields)
      .setFooter({ text: "Keep working hard to climb the ranks!" })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
};