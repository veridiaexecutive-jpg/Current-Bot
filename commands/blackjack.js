const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getBalance, updateBalance, getCooldownSeconds, setCooldown, getGovernmentBalance, updateGovernmentBalance, getLifetimeEarnings, updateLifetimeEarnings } = require("../database/economy");

const DECK_TEMPLATE = [
  { value: 2, name: "2" },
  { value: 3, name: "3" },
  { value: 4, name: "4" },
  { value: 5, name: "5" },
  { value: 6, name: "6" },
  { value: 7, name: "7" },
  { value: 8, name: "8" },
  { value: 9, name: "9" },
  { value: 10, name: "10" },
  { value: 10, name: "Jack" },
  { value: 10, name: "Queen" },
  { value: 10, name: "King" },
  { value: 11, name: "Ace" }
];

function createShuffledDeck() {
  const deck = [];
  for (let i = 0; i < 4; i++) {
    for (const card of DECK_TEMPLATE) {
      deck.push({ ...card });
    }
  }
  shuffleDeck(deck);
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
}

function dealCard(deck) {
  if (deck.length === 0) deck.push(...createShuffledDeck());
  return deck.pop();
}

function calculateHandValue(hand) {
  let total = 0;
  let aces = 0;

  for (const card of hand) {
    total += card.value;
    if (card.name === "Ace") aces++;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function formatHand(cards, hideFirst = false) {
  if (hideFirst && cards.length > 1) {
    return `🂠 ${cards.slice(1).map(card => card.name).join(" ")}`;
  }
  return cards.map(card => card.name).join(" ");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play blackjack against the dealer")
    .addIntegerOption(option =>
      option
        .setName("amount")
        .setDescription("Amount to bet")
        .setRequired(true)
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    const betAmount = interaction.options.getInteger("amount");

    const cooldownRemaining = getCooldownSeconds(userId, "blackjack");
    if (cooldownRemaining > 0) {
      return interaction.reply({
        content: `⏳ You're on cooldown. Try again in **${cooldownRemaining}s**.`,
        ephemeral: true,
      });
    }

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

    const maxBet = Math.min(
      Math.floor(balance * 0.25),
      Math.floor(lifetimeEarnings * 0.25)
    );

    if (betAmount > maxBet) {
      return interaction.reply({
        content: `❌ Maximum bet is **₳${maxBet}** (25% of your balance or lifetime earnings).`,
        ephemeral: true,
      });
    }

    setCooldown(userId, "blackjack", 30);

    const deck = createShuffledDeck();
    const playerCards = [dealCard(deck), dealCard(deck)];
    const dealerCards = [dealCard(deck), dealCard(deck)];

    const playerTotal = calculateHandValue(playerCards);
    const dealerTotal = calculateHandValue(dealerCards);

    if (playerCards.length === 2 && playerTotal === 21) {
      const govBalance = getGovernmentBalance();
      const payout = Math.floor(betAmount * 1.5);

      if (govBalance < payout) {
        return interaction.reply({
          content: "❌ Government doesn't have enough funds to pay out. Try again later.",
          ephemeral: true,
        });
      }

      updateBalance(userId, payout);
      updateLifetimeEarnings(userId, payout);
      updateGovernmentBalance(-payout);

      const newBalance = getBalance(userId);
      const embed = new EmbedBuilder()
        .setTitle("🎴 Blackjack - BLACKJACK!")
        .setColor("#FFD700")
        .addFields(
          { name: "Your Cards", value: formatHand(playerCards), inline: true },
          { name: "Your Total", value: `${playerTotal}`, inline: true },
          { name: "Dealer Cards", value: formatHand(dealerCards), inline: true },
          { name: "Bet", value: `₳${betAmount}`, inline: true },
          { name: "Payout", value: `₳${payout}`, inline: true },
          { name: "Your Balance", value: `₳${newBalance}`, inline: false }
        )
        .setFooter({ text: "Natural blackjack! 1.5x payout" });

      return interaction.reply({ embeds: [embed] });
    }

    const gameState = {
      userId,
      betAmount,
      deck,
      playerCards,
      dealerCards,
      finished: false,
    };

    const hitButton = new ButtonBuilder()
      .setCustomId(`blackjack_hit_${userId}`)
      .setLabel("Hit")
      .setStyle(ButtonStyle.Primary);

    const standButton = new ButtonBuilder()
      .setCustomId(`blackjack_stand_${userId}`)
      .setLabel("Stand")
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(hitButton, standButton);

    const embed = new EmbedBuilder()
      .setTitle("🎴 Blackjack")
      .setColor("#0099FF")
      .addFields(
        { name: "Your Cards", value: formatHand(playerCards), inline: true },
        { name: "Your Total", value: `${playerTotal}`, inline: true },
        { name: "Dealer Cards", value: formatHand(dealerCards, true), inline: true },
        { name: "Bet", value: `₳${betAmount}`, inline: false }
      )
      .setFooter({ text: "Choose your action" });

    const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    const collector = message.createMessageComponentCollector({
      filter: i => i.user.id === userId && i.customId.startsWith("blackjack_"),
      time: 30000,
    });

    collector.on("collect", async buttonInteraction => {
      const action = buttonInteraction.customId.split("_")[1];
      if (gameState.finished) {
        return buttonInteraction.reply({ content: "This game is already finished.", ephemeral: true });
      }

      if (action === "hit") {
        gameState.playerCards.push(dealCard(gameState.deck));
        const playerScore = calculateHandValue(gameState.playerCards);

        if (playerScore > 21) {
          gameState.finished = true;
          updateBalance(userId, -gameState.betAmount);

          disableButtons(row);
          const finalEmbed = new EmbedBuilder()
            .setTitle("🎴 Blackjack - Busted")
            .setColor("#AA0000")
            .addFields(
              { name: "Your Cards", value: formatHand(gameState.playerCards), inline: true },
              { name: "Your Total", value: `${playerScore}`, inline: true },
              { name: "Dealer Cards", value: formatHand(gameState.dealerCards), inline: true },
              { name: "Result", value: "🔴 You busted and lost your bet.", inline: false },
              { name: "Bet Lost", value: `₳${gameState.betAmount}`, inline: true }
            )
            .setFooter({ text: "Better luck next time." });

          await buttonInteraction.update({ embeds: [finalEmbed], components: [row] });
          collector.stop();
          return;
        }

        const newEmbed = new EmbedBuilder()
          .setTitle("🎴 Blackjack")
          .setColor("#0099FF")
          .addFields(
            { name: "Your Cards", value: formatHand(gameState.playerCards), inline: true },
            { name: "Your Total", value: `${playerScore}`, inline: true },
            { name: "Dealer Cards", value: formatHand(gameState.dealerCards, true), inline: true },
            { name: "Bet", value: `₳${gameState.betAmount}`, inline: false }
          )
          .setFooter({ text: "Choose your action" });

        await buttonInteraction.update({ embeds: [newEmbed], components: [row] });
        return;
      }

      if (action === "stand") {
        const playerScore = calculateHandValue(gameState.playerCards);
        let dealerScore = calculateHandValue(gameState.dealerCards);

        while (dealerScore < 17) {
          gameState.dealerCards.push(dealCard(gameState.deck));
          dealerScore = calculateHandValue(gameState.dealerCards);
        }

        gameState.finished = true;
        disableButtons(row);

        let resultEmbed = new EmbedBuilder()
          .setTitle("🎴 Blackjack")
          .setColor("#0099FF")
          .addFields(
            { name: "Your Cards", value: formatHand(gameState.playerCards), inline: true },
            { name: "Your Total", value: `${playerScore}`, inline: true },
            { name: "Dealer Cards", value: formatHand(gameState.dealerCards), inline: true },
            { name: "Dealer Total", value: `${dealerScore}`, inline: true },
            { name: "Bet", value: `₳${gameState.betAmount}`, inline: false }
          );

        if (dealerScore > 21 || playerScore > dealerScore) {
          updateBalance(userId, gameState.betAmount);
          updateLifetimeEarnings(userId, gameState.betAmount);
          resultEmbed = resultEmbed
            .setTitle("🎴 Blackjack - You Win")
            .setColor("#00AA00")
            .addFields({ name: "Result", value: `🟢 You won ₳${gameState.betAmount}!`, inline: false });
        } else if (playerScore < dealerScore) {
          updateBalance(userId, -gameState.betAmount);
          resultEmbed = resultEmbed
            .setTitle("🎴 Blackjack - You Lose")
            .setColor("#AA0000")
            .addFields({ name: "Result", value: `🔴 You lost ₳${gameState.betAmount}.`, inline: false });
        } else {
          resultEmbed = resultEmbed
            .setTitle("🎴 Blackjack - Push")
            .setColor("#FFFF00")
            .addFields({ name: "Result", value: "⚪ It's a tie. Your bet is returned.", inline: false });
        }

        await buttonInteraction.update({ embeds: [resultEmbed], components: [row] });
        collector.stop();
        return;
      }
    });

    collector.on("end", async () => {
      if (!gameState.finished) {
        disableButtons(row);
        const timeoutEmbed = new EmbedBuilder()
          .setTitle("🎴 Blackjack")
          .setColor("#999999")
          .addFields(
            { name: "Status", value: "Game timed out.", inline: false }
          )
          .setFooter({ text: "You can start a new game anytime." });
        await message.edit({ embeds: [timeoutEmbed], components: [row] });
      }
    });
  }
};

function disableButtons(row) {
  row.components.forEach(button => button.setDisabled(true));
}

