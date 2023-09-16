import { orderStatus } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import bot, { prisma } from "..";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import fillOrderMessage from "../utils/fillOrderMessage";
import kitchenChannels from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";

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
      deliveryChannelId: string;
      backticks: boolean;
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
  const deliveringOrdersChannel =
    await kitchenChannels.deliveringOrdersChannel();
  if (!deliveringOrdersChannel?.isTextBased())
    return {
      success: false,
      message: "Failed to fetch delivering orders channel",
    };
  const logsChannel = await kitchenChannels.logsChannel();
  if (!logsChannel?.isTextBased())
    return { success: false, message: "Failed to fetch logs channel" };
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
    maxAge: 3600,
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
  const chefRecord = await prisma.chef.upsert({
    where: {
      id: deliveryId,
    },
    update: {},
    create: {
      id: deliveryId,
      message: "Hey $mention! Here's your order! $item",
    },
  });
  await logsChannel.send({
    content: `${emojiInline.materialPackage2} <@!${deliveryId}> started delivering order **#${order.id}**`,
    allowedMentions: { parse: [] },
  });
  return {
    success: true,
    message: `Order ${order.id} is being delivered`,
    invite: invite.url,
    deliveryMessage: fillOrderMessage(order, chefRecord.message!),
    deliveringMessageId: deliveringOrderMessage.id,
    deliveryChannelId: targetChannel.id,
    backticks: chefRecord.backticks,
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
  const deliveredOrdersChannel = await kitchenChannels.deliveredOrdersChannel();
  if (!deliveredOrdersChannel?.isTextBased())
    return {
      success: false,
      message: "Failed to fetch delivered orders channel",
    };
  const logsChannel = await kitchenChannels.logsChannel();
  if (!logsChannel?.isTextBased())
    return { success: false, message: "Failed to fetch logs channel" };
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
  await logsChannel.send({
    content: `${emojiInline.materialLocalPostOffice} <@!${order.deliveryId}> marked order **#${order.id}** delivered`,
    allowedMentions: { parse: [] },
  });
  return { success: true, message: `Order ${order.id} has been delivered` };
};
