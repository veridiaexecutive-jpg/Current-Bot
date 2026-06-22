const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { getBalance, updateBalance, getGovernmentBalance, updateGovernmentBalance, getUserLoans, getPendingLoans, createLoan, acceptLoan, rejectLoan, repayLoan, getLoan, ensureUser, isCitizen, getCreditScore } = require("../database/economy");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("loan")
    .setDescription("National bank loan management")
    .addSubcommand(subcommand =>
      subcommand
        .setName("request")
        .setDescription("Request a loan from the national bank")
        .addIntegerOption(option =>
          option
            .setName("amount")
            .setDescription("Amount to borrow")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("repay")
        .setDescription("Repay a loan")
        .addIntegerOption(option =>
          option
            .setName("loan_id")
            .setDescription("Loan ID to repay")
            .setRequired(true)
        )
        .addIntegerOption(option =>
          option
            .setName("amount")
            .setDescription("Amount to repay")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("list")
        .setDescription("View your active loans")
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("accept")
        .setDescription("(Directors only) Accept a pending loan request")
        .addIntegerOption(option =>
          option
            .setName("loan_id")
            .setDescription("Loan ID to accept")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("pending")
        .setDescription("(Directors only) View pending loan requests")
    ),

  async execute(interaction) {
    const userId = interaction.user.id;
    ensureUser(userId);
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "request") {
      await handleRequest(interaction, userId);
    } else if (subcommand === "repay") {
      await handleRepay(interaction, userId);
    } else if (subcommand === "list") {
      await handleList(interaction, userId);
    } else if (subcommand === "accept") {
      await handleAccept(interaction, userId);
    } else if (subcommand === "pending") {
      await handlePending(interaction, userId);
    }
  }
};

async function handleRequest(interaction, userId) {
  // Check if user is a citizen
  if (!isCitizen(userId)) {
    return interaction.editReply({
      content: "❌ You must be a citizen to request loans. Pay your upkeep with `/upkeep pay`.",
      flags: 64,
    });
  }

  const amount = interaction.options.getInteger("amount");

  if (amount <= 0) {
    return interaction.editReply({
      content: "❌ Loan amount must be positive.",
      flags: 64,
    });
  }

  // Max loan based on credit score
  const balance = getBalance(userId);
  const creditScore = getCreditScore(userId);
  const maxLoan = Math.floor(balance * (creditScore / 1000));

  if (amount > maxLoan) {
    return interaction.editReply({
      content: `❌ Maximum loan is **₳${maxLoan}** based on your credit score (${creditScore}). You have **₳${balance}**.`,
      flags: 64,
    });
  }

  // Create the pending loan
  const loanId = createLoan(userId, amount);
  const loan = getLoan(loanId);

  const embed = new EmbedBuilder()
    .setTitle("📋 Loan Request Submitted")
    .setColor("#FFAA00")
    .addFields(
      { name: "Loan ID", value: `#${loanId}`, inline: true },
      { name: "Requested Amount", value: `₳${amount}`, inline: true },
      { name: "Interest (10%)", value: `₳${Math.floor(amount * 0.10)}`, inline: true },
      { name: "Total Owed (if approved)", value: `₳${loan.amount_owed}`, inline: true },
      { name: "Status", value: "⏳ Pending Director Approval", inline: false }
    )
    .setFooter({ text: "A National Bank Director will review your request soon" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleRepay(interaction, userId) {
  const loanId = interaction.options.getInteger("loan_id");
  const repayAmount = interaction.options.getInteger("amount");

  if (repayAmount <= 0) {
    return interaction.editReply({
      content: "❌ Repayment amount must be positive.",
      flags: 64,
    });
  }

  const loan = getLoan(loanId);

  if (!loan) {
    return interaction.editReply({
      content: "❌ Loan not found.",
      flags: 64,
    });
  }

  if (loan.user_id !== userId) {
    return interaction.editReply({
      content: "❌ This is not your loan.",
      flags: 64,
    });
  }

  if (loan.status !== "accepted") {
    return interaction.editReply({
      content: `❌ This loan has not been approved yet (Status: **${loan.status}**).`,
      flags: 64,
    });
  }

  if (loan.paid_off === 1) {
    return interaction.editReply({
      content: "❌ This loan has already been paid off.",
      flags: 64,
    });
  }

  const balance = getBalance(userId);

  if (balance < repayAmount) {
    return interaction.editReply({
      content: `❌ You don't have enough AYD. Balance: **₳${balance}**`,
      flags: 64,
    });
  }

  if (repayAmount > loan.amount_owed) {
    return interaction.editReply({
      content: `❌ Repayment exceeds amount owed. Amount owed: **₳${loan.amount_owed}**.`,
      flags: 64,
    });
  }

  // Process repayment
  updateBalance(userId, -repayAmount);
  updateGovernmentBalance(repayAmount);
  repayLoan(loanId, repayAmount);

  const updatedLoan = getLoan(loanId);
  const newBalance = getBalance(userId);

  let statusText = "Loan partially repaid";
  if (updatedLoan.paid_off === 1) {
    statusText = "Loan fully repaid! 🎉";
  }

  const embed = new EmbedBuilder()
    .setTitle("💳 Loan Repayment")
    .setColor("#00AA00")
    .addFields(
      { name: "Loan ID", value: `#${loanId}`, inline: true },
      { name: "Repayment Amount", value: `₳${repayAmount}`, inline: true },
      { name: "Status", value: statusText, inline: true },
      { name: "Amount Still Owed", value: `₳${updatedLoan.amount_owed}`, inline: true },
      { name: "Your New Balance", value: `₳${newBalance}`, inline: false }
    );

  await interaction.editReply({ embeds: [embed] });
}

async function handleList(interaction, userId) {
  const loans = getUserLoans(userId);

  if (loans.length === 0) {
    return interaction.editReply({
      content: "✅ You have no active loans.",
      flags: 64,
    });
  }

  const fields = loans.map(loan => {
    const dueDate = new Date(loan.due_date);
    const timestamp = Math.floor(dueDate.getTime() / 1000);

    return {
      name: `Loan #${loan.id}`,
      value: `Original: ₳${loan.amount}\nOwed: ₳${loan.amount_owed}\nDue: <t:${timestamp}:R>`,
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setTitle("📋 Your Active Loans")
    .setColor("#0099FF")
    .addFields(...fields)
    .setFooter({ text: "Use /loan repay to pay back loans" });

  await interaction.editReply({ embeds: [embed] });
}

async function handleAccept(interaction, userId) {
  // Role check
  const hasDirectorRole = interaction.member.roles.cache.some(
    role => role.name === "Directors of National Bank"
  );

  if (!hasDirectorRole) {
    return interaction.editReply({
      content: "❌ You must be a **Director of the National Bank** to accept loans.",
      flags: 64,
    });
  }

  const loanId = interaction.options.getInteger("loan_id");
  const loan = getLoan(loanId);

  if (!loan) {
    return interaction.editReply({
      content: "❌ Loan not found.",
      flags: 64,
    });
  }

  if (loan.status !== "pending") {
    return interaction.editReply({
      content: `❌ This loan is already **${loan.status}**.`,
      flags: 64,
    });
  }

  const govBalance = getGovernmentBalance();

  if (govBalance < loan.amount) {
    return interaction.editReply({
      content: `❌ National bank doesn't have enough funds. Available: **₳${govBalance}**.`,
      flags: 64,
    });
  }

  // Accept the loan
  acceptLoan(loanId);

  // Give player the money and deduct from government
  updateBalance(loan.user_id, loan.amount);
  updateGovernmentBalance(-loan.amount);

  const dueDate = new Date(loan.due_date);
  const timestamp = Math.floor(dueDate.getTime() / 1000);
  const newBalance = getBalance(loan.user_id);

  const embed = new EmbedBuilder()
    .setTitle("✅ Loan Approved by Director")
    .setColor("#00AA00")
    .addFields(
      { name: "Loan ID", value: `#${loanId}`, inline: true },
      { name: "Approved By", value: `<@${userId}>`, inline: true },
      { name: "Loan Amount", value: `₳${loan.amount}`, inline: true },
      { name: "Total Owed", value: `₳${loan.amount_owed}`, inline: true },
      { name: "Due Date", value: `<t:${timestamp}:R>`, inline: true },
      { name: "Borrower Balance", value: `₳${newBalance}`, inline: true }
    )
    .setFooter({ text: "Loan has been disbursed" });

  await interaction.editReply({ embeds: [embed] });
}

async function handlePending(interaction, userId) {
  // Role check
  const hasDirectorRole = interaction.member.roles.cache.some(
    role => role.name === "Directors of National Bank"
  );

  if (!hasDirectorRole) {
    return interaction.editReply({
      content: "❌ You must be a **Director of the National Bank** to view pending loans.",
      flags: 64,
    });
  }

  const loans = getPendingLoans();

  if (loans.length === 0) {
    return interaction.editReply({
      content: "✅ No pending loan requests.",
      flags: 64,
    });
  }

  const fields = loans.map(loan => {
    const createdDate = new Date(loan.created_at);
    const timestamp = Math.floor(createdDate.getTime() / 1000);

    return {
      name: `Loan #${loan.id}`,
      value: `Requested by: <@${loan.user_id}>\nAmount: ₳${loan.amount}\nTotal Owed: ₳${loan.amount_owed}\nRequested: <t:${timestamp}:R>\nUse \`/loan accept ${loan.id}\` to approve`,
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setTitle("📋 Pending Loan Requests")
    .setColor("#FFAA00")
    .addFields(...fields)
    .setFooter({ text: `${loans.length} pending request(s)` });

  await interaction.editReply({ embeds: [embed] });
}
