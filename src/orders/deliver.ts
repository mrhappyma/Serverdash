import { orderStatus } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import bot, { prisma } from "..";
import env from "../utils/env";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";

declare type startDeliveringOrderResponse =
  | {
      success: false;
      message: string;
    }
  | {
      success: true;
      message: string;
      invite: string;
      deliveryMessage: string;
      deliveringMessageId: string;
    };

export const startDeliveringOrder = async (
  orderId: number,
  deliveryId: string,
  deliveryUsername: string
): Promise<startDeliveringOrderResponse> => {
  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.DELIVERING,
        deliveryId: deliveryId,
        deliveryUsername: deliveryUsername,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to start delivering order" };
  }
  const deliveringOrdersChannel = await (
    await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
  ).channels.fetch(env.DELIVERING_ORDERS_CHANNEL_ID);
  if (!deliveringOrdersChannel?.isTextBased())
    return {
      success: false,
      message: "Failed to fetch delivering orders channel",
    };
  const deliveringActionRow =
    new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(`order:${order.id}:complete`)
        .setLabel("Complete Order")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("Reject Order")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`order:${order.id}:reject`),
    ]);
  const deliveringEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  const deliveringOrderMessage = await deliveringOrdersChannel.send({
    embeds: [deliveringEmbed],
    components: [deliveringActionRow],
    content: `<@!${order.deliveryId}>`,
  });
  const targetChannel = await (
    await bot.client.guilds.fetch(order.guildId)
  ).channels.fetch(order.channelId);
  if (!targetChannel?.isTextBased() || targetChannel.isThread())
    return { success: false, message: "Failed to fetch target channel" };
  const invite = await targetChannel.createInvite({
    maxAge: 0,
    maxUses: 1,
    unique: true,
    reason: `Order ${order.id} delivery invite`,
  });
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is being delivered by ${deliveryUsername}`
    );
  return {
    success: true,
    message: `Order ${order.id} is being delivered`,
    invite: invite.url,
    deliveryMessage: `Here's your order! ${order.fileUrl}`,
    deliveringMessageId: deliveringOrderMessage.id,
  };
};

export const finishDelivery = async (orderId: number, deliveryId: string) => {
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
  if (!order) return { success: false, message: "Failed to fetch order" };
  if (order.deliveryId != deliveryId)
    return {
      success: false,
      message: "You are not the delivery driver for this order",
    };
  try {
    await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.DELIVERED,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to mark delivery finished" };
  }
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order has been delivered!`
    );
  const deliveredOrdersChannel = await (
    await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
  ).channels.fetch(env.DELIVERED_ORDERS_CHANNEL_ID);
  if (!deliveredOrdersChannel?.isTextBased())
    return {
      success: false,
      message: "Failed to fetch delivered orders channel",
    };
  const deliveredEmbed = new EmbedBuilder()
    .setTitle(`Order #${order.id}`)
    .setDescription(order.order)
    .addFields([
      {
        name: "Customer",
        value: `<@!${order.customerId}>`,
      },
      {
        name: "Chef",
        value: `<@!${order.chefId}>`,
      },
      {
        name: "Delivery Driver",
        value: `<@!${order.deliveryId}>`,
      },
    ])
    .setImage(order.fileUrl);
  await deliveredOrdersChannel.send({
    embeds: [deliveredEmbed],
  });
  return { success: true, message: `Order ${order.id} has been delivered` };
};
