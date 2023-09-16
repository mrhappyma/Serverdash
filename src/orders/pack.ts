import { orderStatus } from "@prisma/client";
import bot, { prisma } from "..";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import env from "../utils/env";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import kitchenChannels from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";

const packOrder = async (orderId: number, url: string, chefId: string) => {
  const orderP = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
  if (!orderP) return { success: false, message: "Order not found" };
  if (orderP.chefId !== chefId)
    return { success: false, message: "You are not the chef of this order" };
  const request = await fetch(url);
  if (!request.ok) return { success: false, message: "Failed to fetch image" };
  const allowedContentTypes = ["image/png", "image/jpeg", "image/gif"];
  if (!allowedContentTypes.includes(request.headers.get("content-type") ?? ""))
    return { success: false, message: "Invalid image type" };

  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.PACKING,
        fileUrl: url,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to pack order" };
  }
  const timestampIn5Minutes = new Date(Date.now() + 5 * 60 * 1000);
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is being packed! It will be done <t:${Math.round(
        timestampIn5Minutes.getTime() / 1000
      ).toString()}:R>`
    );
  setTimeout(() => finishPackOrder(orderId), 1000 * 60 * 5);
  const logsChannel = await kitchenChannels.logsChannel();
  if (!logsChannel?.isTextBased())
    return { success: false, message: "Failed to fetch logs channel" };
  await logsChannel.send({
    content: `${emojiInline.materialLunchDining} <@!${chefId}> finished filling order **#${orderId}**`,
    allowedMentions: { parse: [] },
  });
  return {
    success: true,
    message: `Order ${order.id} is being packed`,
  };
};
export default packOrder;

export const finishPackOrder = async (orderId: number) => {
  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.PACKED,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to finish packing order" };
  }
  const deliveryChannel = await (
    await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
  ).channels.fetch(env.READY_ORDERS_CHANNEL_ID);
  if (!deliveryChannel?.isTextBased())
    return { success: false, message: "Failed to fetch delivery channel" };
  const deliveryActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    [
      new ButtonBuilder()
        .setCustomId(`order:${order.id}:deliver`)
        .setLabel("Deliver Order")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("Reject Order")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`order:${order.id}:reject`),
    ]
  );
  const deliveryEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  await deliveryChannel.send({
    embeds: [deliveryEmbed],
    components: [deliveryActionRow],
    content: `<@&${env.DELIVERY_PING_ROLE_ID}>`,
  });
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is ready for delivery!`
    );
  return {
    success: true,
    message: `Order ${order.id} is ready for delivery`,
  };
};
