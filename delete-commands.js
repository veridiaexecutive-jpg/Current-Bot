const { REST, Routes } = require("discord.js");
require("dotenv").config();

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("Deleting ALL global slash commands…");

    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: [] }
    );

    console.log("All global commands deleted.");
  } catch (error) {
    console.error(error);
  }
  await rest.put(
  Routes.applicationGuildCommands(CLIENT_ID, process.env.GUILD_ID),
  { body: [] }
);
  console.log("All guild commands deleted.");
})();