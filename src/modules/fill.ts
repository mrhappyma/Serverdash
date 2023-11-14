import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import bot, { prisma } from "..";
import env from "../utils/env";
import { orderStatus } from "@prisma/client";
import { emojiInline } from "../utils/emoji";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import {
  KitchenChannel,
  clearKitchenMessages,
  sendKitchenMessage,
} from "../utils/kitchenChannels";

bot.registerButton("order:(\\d+):fill", async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const ocheck = await prisma.order.findUnique({
    where: {
      id: parseInt(orderId),
    },
  });
  if (!ocheck)
    return interaction.reply({ content: "Order not found", ephemeral: true });
  if (ocheck.status !== orderStatus.ORDERED)
    return interaction.reply({
      content: "Can't claim order- status is not ORDERED",
      ephemeral: true,
    });

  try {
    var order = await prisma.order.update({
      where: {
        id: parseInt(orderId),
      },
      data: {
        status: orderStatus.FILLING,
        chefId: interaction.user.id,
        chefUsername: interaction.user.username,
      },
    });
  } catch (e) {
    return interaction.reply({
      content: "Failed to claim order",
      ephemeral: true,
    });
  }

  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is being filled by ${interaction.user.username}`
    );
  await clearKitchenMessages(order.id);
  const orderFillingActionRow =
    new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(`order:${order.id}:pack`)
        .setLabel("Pack Order")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("Reject Order")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`order:${order.id}:reject`),
    ]);
  const orderFillingEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  const orderFillingMessage = await sendKitchenMessage(
    KitchenChannel.fillOrders,
    {
      embeds: [orderFillingEmbed],
      components: [orderFillingActionRow],
      content: `<@!${order.chefId}>`,
    },
    order.id
  );
  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialEdit} <@!${interaction.user.id}> claimed order **#${order.id}**`,
    allowedMentions: { parse: [] },
  });
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Jump to message")
      .setURL(
        `https://discord.com/channels/${env.KITCHEN_SERVER_ID}/${env.FILL_ORDERS_CHANNEL_ID}/${orderFillingMessage.id}`
      )
      .setStyle(ButtonStyle.Link),
  ]);
  return interaction.reply({
    content: `Claimed!`,
    components: [actionRow],
    ephemeral: true,
  });
});
