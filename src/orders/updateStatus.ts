import { order, orderStatus } from "@prisma/client";
import { getActiveOrdersForChef, getOrder, updateOrder } from "./cache";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextBasedChannel,
} from "discord.js";
import env from "../utils/env";
import {
  sendKitchenMessage,
  KitchenChannel,
  clearKitchenMessages,
  editKitchenMessage,
} from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import sendLogMessage from "../utils/log";
import { updateOrderStatusParams, updateOrderStatusResponse } from "./types";
import bot, { messagesClient } from "..";
import { finishPackOrder } from "../modules/pack";
import { fileUrl } from "../utils/fillOrderMessage";
import { updateProcessingOrders } from "../modules/metrics";

const updateOrderStatus = async (
  p: updateOrderStatusParams
): Promise<updateOrderStatusResponse> => {
  const { id, status, chef, admin } = p;

  let order = await getOrder(id);
  if (!order) {
    return {
      success: false,
      message: "Order not found",
    };
  }

  //CHECKS
  if (!admin) {
    const active = getActiveOrdersForChef(chef);
    const verb = active[0]?.status === orderStatus.PACKING ? "pack" : "deliver";

    try {
      switch (status) {
        case orderStatus.FILLING:
          if (active.length > 0)
            throw new Error(
              `You are already ${verb}ing order #**${active[0].id}**! One at a time please, go finish that one first!`
            );
          if (order.status != orderStatus.ORDERED)
            throw new Error("Order status is not ORDERED");
          break;
        case orderStatus.PACKING:
          if (order.status != orderStatus.FILLING)
            throw new Error("Order status is not FILLING");
          if (order.chefId != chef)
            throw new Error("You are not the chef for this order");
          //TODO: more packing logic could be moved here
          break;
        case orderStatus.DELIVERING:
          if (order.status == orderStatus.DELIVERING)
            throw new Error(
              "Too slow- somebody's already started delivering this order"
            );
          if (order.status != orderStatus.PACKED)
            throw new Error("Order status is not PACKED");
          if (order.customerUsername == chef)
            throw new Error(
              "you ordered this! who are you gonna deliver to, yourself?"
            );
          break;
        case orderStatus.DELIVERED:
          if (order.status != orderStatus.DELIVERING)
            throw new Error("Order status is not DELIVERING");
          if (order.deliveryId != chef)
            throw new Error("You are not the delivery person for this order");
        case orderStatus.REJECTED:
          if (order.status == orderStatus.REJECTED)
            throw new Error("Order already rejected");
      }
    } catch (e) {
      return {
        success: false,
        message: `${e} :(`,
      };
    }
  }

  //KITCHEN ACTION and db update
  switch (p.status) {
    case orderStatus.FILLING:
      order = await updateOrder(id, {
        status,
        chefId: chef,
        chefUsername: p.chefUsername,
      });
      const orderFillingActionRow =
        new ActionRowBuilder<ButtonBuilder>().addComponents([
          new ButtonBuilder()
            .setCustomId(`order:${id}:drop`)
            .setLabel("Unclaim Order")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("Reject Order")
            .setStyle(ButtonStyle.Danger)
            .setCustomId(`order:${id}:reject`),
        ]);
      const orderFillingEmbed = new EmbedBuilder()
        .setTitle(`Order from **${order.customerUsername}**`)
        .setDescription(order.order)
        .setFooter({ text: `Order ID: ${id}` });
      await editKitchenMessage(KitchenChannel.orders, p.interactionMessageId, {
        embeds: [orderFillingEmbed],
        components: [orderFillingActionRow],
        content: `<@!${chef}>`,
      });

      const ordersChannel = (await messagesClient.client.channels.fetch(
        env.NEW_ORDERS_CHANNEL_ID
      )) as TextBasedChannel;
      const orderFillMessage = await ordersChannel.messages.fetch(
        p.interactionMessageId
      );
      await orderFillMessage.startThread({
        name: `Order #${id}`,
        autoArchiveDuration: 60,
        reason: `Order ${id} claimed by ${chef}`,
      });
      break;
    case orderStatus.PACKING:
      order = await updateOrder(id, {
        status,
        fileUrl: p.fileUrl,
      });
      setTimeout(() => finishPackOrder(id), 1000 * 60 * 5);
      await clearKitchenMessages(id);
      break;
    case orderStatus.PACKED:
      order = await updateOrder(id, {
        status,
      });
      const deliveryActionRow =
        new ActionRowBuilder<ButtonBuilder>().addComponents([
          new ButtonBuilder()
            .setCustomId(`order:${id}:deliver`)
            .setLabel("Deliver Order")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel("Reject Order")
            .setStyle(ButtonStyle.Danger)
            .setCustomId(`order:${id}:reject`),
        ]);
      const deliveryEmbed = new EmbedBuilder()
        .setTitle(`Order from **${order.customerUsername}**`)
        .setDescription(order.order)
        .setFooter({ text: `Order ID: ${id}` });
      await sendKitchenMessage(
        KitchenChannel.deliveries,
        {
          embeds: [deliveryEmbed],
          components: [deliveryActionRow],
          content: `<@&${env.DELIVERY_PING_ROLE_ID}>`,
        },
        id
      );
      break;
    case orderStatus.DELIVERING:
      order = await updateOrder(id, {
        status,
        deliveryId: chef,
        deliveryUsername: p.chefUsername,
      });
      try {
        var guild = await bot.client.guilds.fetch(order.guildId);
      } catch (e) {
        throw new Error(
          `Failed to fetch guild! This usually means the bot was kicked, and if so just reject the order. Here's the error:\n\`\`\`${e}\`\`\``
        );
      }
      const targetChannel = guild.channels.cache.get(order.channelId);
      if (!targetChannel?.isTextBased() || targetChannel.isThread())
        throw new Error("Failed to fetch order channel");
      try {
        var invite = await targetChannel.createInvite({
          maxAge: 3600,
          maxUses: 1,
          unique: true,
          reason: `Order #${id} delivery invite`,
        });
      } catch (e) {
        throw new Error(
          `Failed to create the invite! Here's the error:\n\`\`\`${e}\`\`\``
        );
      }
      const deliveringActionRow =
        new ActionRowBuilder<ButtonBuilder>().addComponents([
          new ButtonBuilder()
            .setCustomId(`order:${id}:complete`)
            .setLabel("Complete Order")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel("Reject Order")
            .setStyle(ButtonStyle.Danger)
            .setCustomId(`order:${id}:reject`),
          new ButtonBuilder()
            .setLabel("Get Content")
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`order:${id}:content`),
        ]);
      const deliveringEmbed = new EmbedBuilder()
        .setTitle(`Order from **${order.customerUsername}**`)
        .setDescription(order.order)
        .setFooter({ text: `Order ID: ${id}` });
      await editKitchenMessage(
        KitchenChannel.deliveries,
        p.interactionMessageId,
        {
          embeds: [deliveringEmbed],
          components: [deliveringActionRow],
          content: `<@!${chef}>`,
        }
      );
      order = await updateOrder(id, {
        status,
        invite: invite.url,
      });
      break;
    case orderStatus.DELIVERED:
      order = await updateOrder(id, {
        status,
      });
      await clearKitchenMessages(id);
      const isImage =
        order.fileUrl?.endsWith(".png") ||
        order.fileUrl?.endsWith(".jpg") ||
        order.fileUrl?.endsWith(".jpeg") ||
        order.fileUrl?.endsWith(".gif") ||
        order.fileUrl?.endsWith(".webp");

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
        ]);
      isImage ? deliveredEmbed.setImage(fileUrl(order.fileUrl!)!) : null;
      await sendKitchenMessage(KitchenChannel.deliveredOrders, {
        content: fileUrl(order.fileUrl!) ?? undefined,
        embeds: [deliveredEmbed],
      });
      break;
    case orderStatus.REJECTED:
      order = await updateOrder(id, {
        status,
        rejectorId: chef,
        rejectedReason: p.reason,
      });
      await clearKitchenMessages(id);
      const orderRejectionEmbed = new EmbedBuilder()
        .setTitle(`Order from **${order.customerUsername}**`)
        .setDescription(order.order)
        .addFields([
          { name: "Reason", value: p.reason },
          { name: "Rejected by", value: `<@!${chef}>` },
        ])
        .setFooter({ text: `Order ID: ${id}` });
      await sendKitchenMessage(KitchenChannel.cancelledOrders, {
        embeds: [orderRejectionEmbed],
      });
  }

  //CUSTOMER STATUS MESSAGE
  let message = "";
  switch (status) {
    case orderStatus.FILLING:
      message = `Your order is being filled by **${p.chefUsername}**!`;
      break;
    case orderStatus.PACKING:
      const timestampIn5Minutes = new Date(Date.now() + 5 * 60 * 1000);
      message = `Your order is being packed! It will be done <t:${Math.round(
        timestampIn5Minutes.getTime() / 1000
      ).toString()}:R>`;
      break;
    case orderStatus.PACKED:
      message = `Your order is ready for delivery!`;
      break;
    case orderStatus.DELIVERING:
      message = `Your order is being delivered by **${p.chefUsername}**!`;
      break;
    case orderStatus.DELIVERED:
      message = `Your order has been delivered!`;
      break;
    case orderStatus.REJECTED:
      message = `Your order has been rejected by the kitchen\n\n${p.reason}\nplease review the order rules: https://dsc.kitchen/rules`;
      break;
  }
  await updateOrderStatusMessage(order, message);

  //LOGS
  let emoji: keyof typeof emojiInline = "materialEdit";
  let logMessage = "";
  switch (status) {
    case orderStatus.FILLING:
      logMessage = `<@!${chef}> claimed order **#${id}**`;
      emoji = "materialEdit";
      break;
    case orderStatus.PACKING:
      logMessage = `<@!${chef}> finished filling order **#${id}**`;
      emoji = "materialLunchDining";
      break;
    case orderStatus.PACKED:
      logMessage = `<@!${chef}> marked order **#${id}** as packed`;
      emoji = "materialPackage2";
      break;
    case orderStatus.DELIVERING:
      logMessage = `<@!${chef}> started delivering order **#${id}**`;
      emoji = "materialPackage2";
      break;
    case orderStatus.DELIVERED:
      logMessage = `<@!${chef}> marked order **#${id}** as delivered`;
      emoji = "materialLocalPostOffice";
      break;
    case orderStatus.REJECTED:
      logMessage = `<@!${chef}> rejected order **#${id}**\n\`\`\`${p.reason}\`\`\``;
      emoji = "materialError";
      break;
  }
  await sendLogMessage(emoji, logMessage);

  updateProcessingOrders(status, id);

  return {
    success: true,
    message: "Order status updated",
    order,
  };
};

export default updateOrderStatus;

/**
 * Updates an order status to FILLING, updates user, and sends it to the kitchen for filling.
 * used for creating orders, dropping orders, and manually switching orders to FILLING
 *
 * DOES NOT ADD LOGS, since each use case is so different.
 * @param order target order
 * @param updateDB whether the database needs to be updated to reflect this. default true.
 */
export const sendOrderForFilling = async (order: order, updateDB = true) => {
  if (updateDB) await updateOrder(order.id, { status: orderStatus.ORDERED });
  await clearKitchenMessages(order.id);

  const kitchenActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`order:${order.id}:fill`)
      .setLabel("Fill Order")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Reject Order")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`order:${order.id}:reject`),
  ]);
  const kitchenEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  await sendKitchenMessage(
    KitchenChannel.orders,
    {
      embeds: [kitchenEmbed],
      components: [kitchenActionRow],
      content: `<@&${env.ORDER_PING_ROLE_ID}>`,
    },
    order.id
  );

  await updateOrderStatusMessage(
    order,
    `Order ${order.id} has been sent to the kitchen!`
  );
};
