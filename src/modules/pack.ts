import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot from "..";
import packOrder from "../orders/pack";
import env from "../utils/env";

bot.registerButton(/order:(\d+):pack/, async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const modal = new ModalBuilder()
    .setTitle("Pack Order")
    .setCustomId(`order:${orderId}:pack:modal`)
    .addComponents([
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId(`url:${interaction.message.id}`)
          .setLabel("File URL")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(1000),
      ]),
    ]);
  return interaction.showModal(modal);
});

bot.registerModal(/order:(\d+):pack:modal/, async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const url = interaction.components[0].components[0].value;
  const newOrdersMessageId =
    interaction.components[0].components[0].customId.split(":")[1];
  const pack = await packOrder(parseInt(orderId), url, interaction.user.id);
  if (!pack.success)
    return interaction.reply({ content: pack.message, ephemeral: true });
  const fillOrdersChannel = await (
    await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
  ).channels.fetch(env.FILL_ORDERS_CHANNEL_ID);
  if (!fillOrdersChannel?.isTextBased())
    return interaction.reply({
      content: "Failed to fetch new orders channel",
      ephemeral: true,
    });
  const newOrdersMessage = await fillOrdersChannel.messages.fetch(
    newOrdersMessageId
  );
  await newOrdersMessage.delete();
  return interaction.reply({ content: pack.message, ephemeral: true });
});
