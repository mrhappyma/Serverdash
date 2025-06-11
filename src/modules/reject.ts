import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot from "..";
import { orderStatus } from "@prisma/client";
import updateOrderStatus from "../orders/updateStatus";

bot.registerButton(/order:(\d+):reject/, async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const modal = new ModalBuilder()
    .setTitle("Reject Order")
    .setCustomId(`order:${orderId}:reject:modal`)
    .addComponents([
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId(`reason:${interaction.message.id}`)
          .setLabel("Reason")
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000),
      ]),
    ]);
  return interaction.showModal(modal);
});

bot.registerModal(/order:(\d+):reject:modal/, async (interaction) => {
  const orderId = parseInt(interaction.customId.split(":")[1]);
  const reason = interaction.components[0].components[0].value;

  const update = await updateOrderStatus({
    id: orderId,
    status: orderStatus.REJECTED,
    chef: interaction.user.id,
    reason,
  });

  if (update.success) {
    await interaction.reply({
      content: "Poof, gone.",
      flags: [MessageFlags.Ephemeral],
    });
  } else {
    await interaction.reply({
      content: update.message,
      flags: [MessageFlags.Ephemeral],
    });
  }
});
