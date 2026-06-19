const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBalance, updateBalance, getCooldownSeconds, setCooldown, ensureUser, getCreditScore } = require("../database/economy");
const db = require("../database/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("heist")
    .setDescription("Attempt to steal from another player (30-50% success)")
    .addUserOption(option =>
      option
        .setName("target")
        .setDescription("Player to steal from")
        .setRequired(true)
    ),

  async execute(interaction) {
    const attacker = interaction.user.id;
    const target = interaction.options.getUser("target");
    const targetId = target.id;

    // Prevent self-heist
    if (attacker === targetId) {
      return interaction.editReply({
        content: "❌ You can't heist yourself!",
        flags: 64,
      });
    }

    // Check cooldown
    const cooldownRemaining = getCooldownSeconds(attacker, "heist");
    if (cooldownRemaining > 0) {
      return interaction.editReply({
        content: `⏳ You're on heist cooldown. Try again in **${cooldownRemaining}s**.`,
        flags: 64,
      });
    }

    ensureUser(targetId);

    // Get balances
    const attackerBalance = getBalance(attacker);
    const targetBalance = getBalance(targetId);

    if (targetBalance < 500) {
      return interaction.editReply({
        content: `❌ Target doesn't have enough AYD to heist (minimum ₳500).`,
        flags: 64,
      });
    }

    if (attackerBalance < 100) {
      return interaction.editReply({
        content: `❌ You need at least ₳100 to attempt a heist.`,
        flags: 64,
      });
    }

    // Set cooldown (60 seconds for heist)
    setCooldown(attacker, "heist", 60);

    // Success chance: 40% base, reduced by target's credit score
    const targetCreditScore = getCreditScore(targetId);
    const successChance = Math.max(0.10, 0.40 - (targetCreditScore / 2000)); // Minimum 10%
    const succeeded = Math.random() < successChance;

    let result, stealAmount, fineAmount;

    if (succeeded) {
      // Steal 10-30% of target's wallet
      stealAmount = Math.floor(targetBalance * (0.10 + Math.random() * 0.20));
      updateBalance(attacker, stealAmount);
      updateBalance(targetId, -stealAmount);
      result = "success";
    } else {
      // Failure: pay fine (5-15% of attacker's wallet) to government
      fineAmount = Math.floor(attackerBalance * (0.05 + Math.random() * 0.10));
      updateBalance(attacker, -fineAmount);
      updateGovernmentBalance(fineAmount);
      result = "failure";
    }

    const newAttackerBalance = getBalance(attacker);
    const newTargetBalance = getBalance(targetId);

    const embed = new EmbedBuilder()
      .setTitle("🕵️ Heist Attempt")
      .setColor(succeeded ? "#00AA00" : "#AA0000")
      .addFields(
        { name: "Target", value: `<@${targetId}>`, inline: true },
        { name: "Attacker", value: `<@${attacker}>`, inline: true },
        { name: "Success Chance", value: `${Math.round(successChance * 100)}%`, inline: true }
      );

    if (succeeded) {
      embed.addFields(
        { name: "Result", value: "🟢 SUCCESS!", inline: false },
        { name: "Stolen", value: `₳${stealAmount}`, inline: true },
        { name: `${target.username} Lost`, value: `₳${stealAmount}`, inline: true },
        { name: "Your New Balance", value: `₳${newAttackerBalance}`, inline: false }
      );
    } else {
      embed.addFields(
        { name: "Result", value: "🔴 CAUGHT! Fine Paid", inline: false },
        { name: "Fine Amount", value: `₳${fineAmount}`, inline: true },
        { name: "Your New Balance", value: `₳${newAttackerBalance}`, inline: true }
      );
    }

    embed.setFooter({ text: "Higher heist success later with business upgrades!" });

    await interaction.reply({ embeds: [embed] });
  }
};
