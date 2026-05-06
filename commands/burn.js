const { SlashCommandBuilder } = require("discord.js");
const db = require("../database/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("burn")
    .setDescription("Director only — burn AYD from the national bank")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount of AYD to burn")
        .setRequired(true)
    ),

  async execute(interaction) {
    // Role check
    const hasDirectorRole = interaction.member.roles.cache.some(
      role => role.name === "Directors of National Bank"
    );

    if (!hasDirectorRole) {
      return interaction.reply("You must be a **Director of the National Bank** to use this command.");
    }

    const amount = interaction.options.getInteger("amount");

    if (amount <= 0) {
      return interaction.reply("Amount must be greater than zero.");
    }

    const bank = db.prepare(`
      SELECT balance FROM national_bank
    `).get();

    if (bank.balance < amount) {
      return interaction.reply("The national bank does not have enough AYD to burn that amount.");
    }

    db.prepare(`
      UPDATE national_bank SET balance = balance - ?
    `).run(amount);

    await interaction.reply(
      `🔥 **Burned AYD**  
Removed **₳${amount}** from the national bank.`
    );
  }
};