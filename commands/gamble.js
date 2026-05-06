const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBalance, updateBalance, getCooldownSeconds, setCooldown, getGovernmentBalance, updateGovernmentBalance, getLifetimeEarnings, updateLifetimeEarnings } = require("../database/economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("gamble")
    .setDescription("Flip a coin for 2x or lose everything")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount to bet")
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger("amount");

    // Check cooldown
    const cooldownRemaining = getCooldownSeconds(userId, "gamble");
    if (cooldownRemaining > 0) {
      return interaction.reply({
        content: `⏳ You're on cooldown. Try again in **${cooldownRemaining}s**.`,
        ephemeral: true,
      });
    }

    // Validate bet
    if (betAmount <= 0) {
      return interaction.reply({
        content: "❌ Bet amount must be positive.",
        ephemeral: true,
      });
    }

    const balance = getBalance(userId);
    const lifetimeEarnings = getLifetimeEarnings(userId) || 2500;

    if (balance < betAmount) {
      return interaction.reply({
        content: `❌ You don't have enough AYD. Balance: **₳${balance}**`,
        ephemeral: true,
      });
    }

    // Max bet cap based on both current balance and lifetime earnings
    const maxBet = Math.min(
      Math.floor(balance * 0.25),
      Math.floor(lifetimeEarnings * 0.25)
    );

    if (betAmount > maxBet) {
      return interaction.reply({
        content: `❌ Maximum bet is **₳${maxBet}** (25% of your current balance or lifetime earnings, whichever is lower).`,
        ephemeral: true,
      });
    }

    // Set cooldown (10 seconds)
    setCooldown(userId, "gamble", 10);

    // Coin flip: 45% win, 55% lose
    const winChance = Math.random() < 0.45;
    const govBalance = getGovernmentBalance();

    if (winChance) {
      // Check if government has enough to pay out
      if (govBalance < betAmount) {
        return interaction.reply({
          content: "❌ Government doesn't have enough funds to pay out. Try again later.",
          ephemeral: true,
        });
      }
      // Player wins - government pays
      updateBalance(userId, betAmount);
      updateLifetimeEarnings(userId, betAmount);
      updateGovernmentBalance(-betAmount);
    } else {
      // Player loses - money goes to government
      updateBalance(userId, -betAmount);
      updateGovernmentBalance(betAmount);
    }

    const newBalance = getBalance(userId);

    const embed = new EmbedBuilder()
      .setTitle("🎲 Coin Flip")
      .setColor(winChance ? "#00AA00" : "#AA0000")
      .addFields(
        { name: "Bet", value: `₳${betAmount}`, inline: true },
        { name: "Result", value: winChance ? "🟢 WIN" : "🔴 LOSE", inline: true },
        { name: "Payout", value: `₳${winChance ? betAmount * 2 : 0}`, inline: true },
        { name: "Your Balance", value: `₳${newBalance}`, inline: false }
      )
      .setFooter({ text: "45% win chance | 55% lose chance" });

    await interaction.reply({ embeds: [embed] });
  }
};
