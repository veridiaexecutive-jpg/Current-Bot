const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBalance, updateBalance, getCooldownSeconds, setCooldown, getGovernmentBalance, updateGovernmentBalance } = require("../database/economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dice")
    .setDescription("Roll the dice (1-6) for 5x payout")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount to bet")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("number")
        .setDescription("Guess a number 1-6")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(6)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger("amount");
    const guessedNumber = interaction.options.getInteger("number");

    // Check cooldown
    const cooldownRemaining = getCooldownSeconds(userId, "dice");
    if (cooldownRemaining > 0) {
      return interaction.editReply({
        content: `⏳ You're on cooldown. Try again in **${cooldownRemaining}s**.`,
        flags: 64,
      });
    }

    // Validate bet
    if (betAmount <= 0) {
      return interaction.editReply({
        content: "❌ Bet amount must be positive.",
        flags: 64,
      });
    }

    const balance = getBalance(userId);

    if (balance < betAmount) {
      return interaction.editReply({
        content: `❌ You don't have enough AYD. Balance: **₳${balance}**`,
        flags: 64,
      });
    }

    // Max bet cap
    const maxBet = Math.floor(balance * 0.25);
    if (betAmount > maxBet) {
      return interaction.editReply({
        content: `❌ Maximum bet is **₳${maxBet}** (25% of your wallet).`,
        flags: 64,
      });
    }

    // Set cooldown (15 seconds)
    setCooldown(userId, "dice", 15);

    // Roll dice
    const rolledNumber = Math.floor(Math.random() * 6) + 1;
    const won = rolledNumber === guessedNumber;
    const payout = won ? betAmount * 5 : 0;
    const govBalance = getGovernmentBalance();

    if (won) {
      // Check if government has enough to pay out
      if (govBalance < payout) {
        return interaction.editReply({
          content: "❌ Government doesn't have enough funds to pay out. Try again later.",
          flags: 64,
        });
      }
      // Player wins - government pays the full 5x
      updateBalance(userId, payout);
      updateGovernmentBalance(-payout);
    } else {
      // Player loses - bet goes to government
      updateBalance(userId, -betAmount);
      updateGovernmentBalance(betAmount);
    }

    const newBalance = getBalance(userId);

    const embed = new EmbedBuilder()
      .setTitle("🎲 Dice Roll")
      .setColor(won ? "#00AA00" : "#AA0000")
      .addFields(
        { name: "Your Guess", value: `🎲 ${guessedNumber}`, inline: true },
        { name: "Bot Rolled", value: `🎲 ${rolledNumber}`, inline: true },
        { name: "Result", value: won ? "🟢 CORRECT" : "🔴 WRONG", inline: true },
        { name: "Bet", value: `₳${betAmount}`, inline: true },
        { name: "Payout", value: `₳${payout}`, inline: true },
        { name: "Your Balance", value: `₳${newBalance}`, inline: false }
      )
      .setFooter({ text: "Win chance: 16.7% | Payout: 5x" });

    await interaction.editReply({ embeds: [embed] });
  }
};
