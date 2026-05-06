const { SlashCommandBuilder } = require("discord.js");
const db = require("../database/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("print")
    .setDescription("Director only — print new AYD into the national bank")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount of AYD to print")
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

    db.prepare(`
      UPDATE national_bank SET balance = balance + ?
    `).run(amount);

    await interaction.reply(
      `💵 **Printed AYD**  
Added **₳${amount}** to the national bank.`
    );
  }
};