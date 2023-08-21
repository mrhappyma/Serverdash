import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot from "..";
import rejectOrder from "../orders/reject";

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
  const orderId = interaction.customId.split(":")[1];
  const reason = interaction.components[0].components[0].value;
  const newOrdersMessageId =
    interaction.components[0].components[0].customId.split(":")[1];
  const reject = await rejectOrder(parseInt(orderId), reason);
  const newOrdersChannel = await (
    await bot.client.guilds.fetch(process.env.KITCHEN_SERVER_ID!)
  ).channels.fetch(process.env.NEW_ORDERS_CHANNEL_ID!);
  if (!newOrdersChannel?.isTextBased())
    return interaction.reply({
      content: "Failed to fetch new orders channel",
      ephemeral: true,
    });
  const newOrdersMessage = await newOrdersChannel.messages.fetch(
    newOrdersMessageId
  );
  if (!newOrdersMessage)
    return interaction.reply({
      content: "Failed to fetch new orders message",
      ephemeral: true,
    });
  await newOrdersMessage.delete();
  return interaction.reply({ content: reject.message, ephemeral: true });
});
