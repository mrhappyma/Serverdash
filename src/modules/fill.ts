import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import bot from "..";
import { startFillingOrder } from "../orders/fill";
import env from "../utils/env";

bot.registerButton("order:(\\d+):fill", async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const fill = await startFillingOrder(
    parseInt(orderId),
    interaction.user.id,
    interaction.user.tag
  );
  interaction.message.delete();
  if (!fill.success)
    return interaction.reply({ content: fill.message, ephemeral: true });
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Jump to message")
      .setURL(
        `https://discord.com/channels/${env.KITCHEN_SERVER_ID}/${env.FILL_ORDERS_CHANNEL_ID}/${fill.messageId}`
      )
      .setStyle(ButtonStyle.Link),
  ]);
  return interaction.reply({
    content: fill.message,
    components: [actionRow],
    ephemeral: true,
  });
});
