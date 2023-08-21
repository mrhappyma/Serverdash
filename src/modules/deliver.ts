import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import bot from "..";
import { startDeliveringOrder, finishDelivery } from "../orders/deliver";
import env from "../utils/env";

bot.registerButton(/order:(\d+):deliver/, async (interaction) => {
  await interaction.deferUpdate();
  const orderId = interaction.customId.split(":")[1];
  const deliver = await startDeliveringOrder(
    parseInt(orderId),
    interaction.user.id,
    interaction.user.tag
  );
  if (!deliver.success)
    return interaction.reply({ content: deliver.message, ephemeral: true });
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Jump to buttons")
      .setURL(
        `https://discord.com/channels/${env.KITCHEN_SERVER_ID}/${env.DELIVERING_ORDERS_CHANNEL_ID}/${deliver.deliveringMessageId}`
      )
      .setStyle(ButtonStyle.Link),
  ]);
  interaction.followUp({
    content: deliver.invite,
    components: [actionRow],
    ephemeral: true,
  });
  interaction.followUp({ content: deliver.deliveryMessage, ephemeral: true });
  interaction.message.delete();
  return;
});

bot.registerButton(/order:(\d+):complete/, async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const complete = await finishDelivery(parseInt(orderId), interaction.user.id);
  if (!complete.success)
    return interaction.reply({ content: complete.message, ephemeral: true });
  interaction.message.delete();
});
