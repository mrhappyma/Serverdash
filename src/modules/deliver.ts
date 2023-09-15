import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import bot, { prisma } from "..";
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
  const actionRowInvite = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Jump to buttons")
      .setURL(
        `https://discord.com/channels/${env.KITCHEN_SERVER_ID}/${env.DELIVERING_ORDERS_CHANNEL_ID}/${deliver.deliveringMessageId}`
      )
      .setStyle(ButtonStyle.Link),
  ]);
  const actionRowMessage = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("toggle codeblock")
      .setStyle(ButtonStyle.Primary)
      .setCustomId(`toggle_backticks`),
  ]);
  interaction.followUp({
    content: `<#${deliver.deliveryChannelId}>\n${deliver.invite}`,
    components: [actionRowInvite],
    ephemeral: true,
  });
  interaction.followUp({
    content: deliver.backticks
      ? `\`\`\`\n${deliver.deliveryMessage}\n\`\`\``
      : deliver.deliveryMessage,
    ephemeral: true,
    components: [actionRowMessage],
  });
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

bot.registerButton("toggle_backticks", async (interaction) => {
  if (
    interaction.message.content.startsWith("```") &&
    interaction.message.content.endsWith("```")
  ) {
    await prisma.chef.update({
      where: {
        id: interaction.user.id,
      },
      data: {
        backticks: false,
      },
    });
    return interaction.update({
      content: interaction.message.content.slice(3, -3),
      components: interaction.message.components,
    });
  } else {
    await prisma.chef.update({
      where: {
        id: interaction.user.id,
      },
      data: {
        backticks: true,
      },
    });
    return interaction.update({
      content: `\`\`\`\n${interaction.message.content}\n\`\`\``,
      components: interaction.message.components,
    });
  }
});
