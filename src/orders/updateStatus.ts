import { order, orderStatus, trainingSession } from "@prisma/client";
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
  editKitchenMessage,
} from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import sendLogMessage from "../utils/log";
import { updateOrderStatusParams, updateOrderStatusResponse } from "./types";
import bot, { messagesClient, prisma } from "..";
import { type PackOrderJob } from "../modules/pack";
import { fileUrl } from "../utils/fillOrderMessage";
import { updateProcessingOrders } from "../modules/metrics";
import agenda from "../modules/jobs";
import { OrderReminderJob } from "../modules/abandonedOrders";
import {
  trainingOrderDelivered,
  trainingOrderFilled,
} from "../modules/training";
import L, { SupportedLocale } from "../i18n";
import { getNickname } from "../modules/nicknames";

const updateOrderStatus = async (
  p: updateOrderStatusParams
): Promise<updateOrderStatusResponse> => {
  const { id, status, chef, admin } = p;
  const chefUsername = await getNickname(chef);

  let order = await getOrder(id);
  if (!order) {
    return {
      success: false,
      message: "Order not found",
    };
  }

  const locale = order.locale as SupportedLocale;

  //CHECKS
  if (!admin) {
    const active = getActiveOrdersForChef(chef);
    const verb = active[0]?.status == orderStatus.FILLING ? "fill" : "deliver";

    if (
      order.trainingSession &&
      order.trainingSession.user != chef &&
      status != orderStatus.PACKED
    ) {
      return {
        success: false,
        message: `You are not the trainee for this order`,
      };
    }

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
          if (active.length > 0)
            throw new Error(
              `You are already ${verb}ing order #**${active[0].id}**! One at a time please, go finish that one first!`
            );
          if (order.status == orderStatus.DELIVERING)
            throw new Error(
              "Too slow- somebody's already started delivering this order"
            );
          if (order.status != orderStatus.PACKED)
            throw new Error("Order status is not PACKED");
          if (order.customerId == chef)
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

  //remove scheduled pack and abandonment jobs
  await agenda.cancel({ "data.orderId": id });

  //KITCHEN ACTION and db update

  const ordersChannel = order.trainingSession
    ? KitchenChannel.training_orders
    : KitchenChannel.orders;
  const ordersChannelId = order.trainingSession
    ? env.TRAINING_NEW_ORDERS_CHANNEL_ID
    : env.NEW_ORDERS_CHANNEL_ID;
  const deliveriesChannel = order.trainingSession
    ? KitchenChannel.training_deliveries
    : KitchenChannel.deliveries;

  switch (p.status) {
    case orderStatus.FILLING:
      const startingStatus = order.status;
      order = await updateOrder(
        id,
        {
          status,
          chefId: chef,
          chefUsername: chefUsername,
        },
        !p.interactionMessageId && true
      );
      const orderFillingActionRow =
        new ActionRowBuilder<ButtonBuilder>().addComponents([
          new ButtonBuilder()
            .setCustomId(`order:${id}:drop`)
            .setLabel("Unclaim Order")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setLabel("Reject Order")
            .setStyle(ButtonStyle.Danger)
            .setCustomId(`order:${id}:reject`)
            .setDisabled(order.trainingSession ? true : false),
        ]);
      const orderFillingEmbed = new EmbedBuilder()
        .setTitle(`Order from **${order.customerUsername}**`)
        .setDescription(order.order)
        .setFooter({ text: `Order ID: ${id}` });

      const fillingBody = {
        embeds: [orderFillingEmbed],
        components: [orderFillingActionRow],
        content: `<@!${chef}>`,
      };
      const fillingMessage = p.interactionMessageId
        ? await editKitchenMessage(
            ordersChannel,
            p.interactionMessageId,
            fillingBody
          )
        : await sendKitchenMessage(ordersChannel, fillingBody, id);

      if (startingStatus != orderStatus.FILLING || !p.interactionMessageId) {
        const channel = (await messagesClient.client.channels.fetch(
          ordersChannelId
        )) as TextBasedChannel;
        const orderFillMessage = await channel.messages.fetch(
          fillingMessage.id
        );
        if (!orderFillMessage.thread) {
          await orderFillMessage.startThread({
            name: `Order #${id}`,
            autoArchiveDuration: 60,
            reason: `Order ${id} claimed by ${chef}`,
          });
        } else {
          await orderFillMessage.thread.join();
        }
      }
      break;
    case orderStatus.PACKING:
      order = await updateOrder(
        id,
        {
          status,
          fileUrl: p.fileUrl,
        },
        true
      );
      if (!order.trainingSession) {
        await agenda.schedule<PackOrderJob>(
          "in 5 minutes",
          "finish packing order",
          {
            orderId: id,
          }
        );
      } else {
        await trainingOrderFilled(order.trainingSession);
      }
      break;
    case orderStatus.PACKED:
      order = await updateOrder(
        id,
        {
          status,
        },
        true
      );
      const deliveryActionRow =
        new ActionRowBuilder<ButtonBuilder>().addComponents([
          new ButtonBuilder()
            .setCustomId(`order:${id}:deliver`)
            .setLabel("Deliver Order")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setLabel("Reject Order")
            .setStyle(ButtonStyle.Danger)
            .setCustomId(`order:${id}:reject`)
            .setDisabled(order.trainingSession ? true : false),
        ]);
      const deliveryEmbed = new EmbedBuilder()
        .setTitle(`Order from **${order.customerUsername}**`)
        .setDescription(order.order)
        .setFooter({ text: `Order ID: ${id}` });
      const ping = order.trainingSession
        ? `<@!${order.trainingSession.user}>`
        : `<@&${env.DELIVERY_PING_ROLE_ID}>`;
      await sendKitchenMessage(
        deliveriesChannel,
        {
          embeds: [deliveryEmbed],
          components: [deliveryActionRow],
          content: ping,
        },
        id
      );
      break;
    case orderStatus.DELIVERING:
      order = await updateOrder(
        id,
        {
          status,
          deliveryId: chef,
          deliveryUsername: chefUsername,
        },
        !p.interactionMessageId && true
      );
      try {
        var guild = await bot.client.guilds.fetch(order.guildId);
      } catch (e) {
        return {
          success: false,
          message: `Failed to fetch guild! This usually means the bot was kicked, and if so just reject the order. Here's the error:\n\`\`\`${e}\`\`\``,
        };
      }
      const targetChannel = guild.channels.cache.get(order.channelId);
      if (!targetChannel?.isTextBased() || targetChannel.isThread())
        return {
          success: false,
          message: "Failed to fetch order channel",
        };
      try {
        //TODO: add caching maybe
        const staticInvite = await prisma.staticGuildInvite.findUnique({
          where: {
            guildId: order.guildId,
          },
        });
        var invite = staticInvite
          ? staticInvite.invite
          : (
              await targetChannel.createInvite({
                maxAge: 3600,
                maxUses: 1,
                unique: true,
                reason: `Order #${id} delivery invite`,
              })
            ).url;
      } catch (e) {
        return {
          success: false,
          message: `Failed to create the invite! Here's the error:\n\`\`\`${e}\`\`\``,
        };
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
            .setCustomId(`order:${id}:reject`)
            .setDisabled(order.trainingSession ? true : false),
          new ButtonBuilder()
            .setLabel("Get Content")
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(`order:${id}:content`),
        ]);
      const deliveringEmbed = new EmbedBuilder()
        .setTitle(`Order from **${order.customerUsername}**`)
        .setDescription(order.order)
        .setFooter({ text: `Order ID: ${id}` });
      const deliveringBody = {
        embeds: [deliveringEmbed],
        components: [deliveringActionRow],
        content: `<@!${chef}>`,
      };
      if (p.interactionMessageId) {
        await editKitchenMessage(
          deliveriesChannel,
          p.interactionMessageId,
          deliveringBody
        );
      } else {
        await sendKitchenMessage(deliveriesChannel, deliveringBody, id);
      }
      order = await updateOrder(id, {
        status,
        invite: invite,
      });
      break;
    case orderStatus.DELIVERED:
      order = await updateOrder(
        id,
        {
          status,
        },
        true
      );
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
      await sendKitchenMessage(
        KitchenChannel.deliveredOrders,
        {
          content: fileUrl(order.fileUrl!) ?? undefined,
          embeds: [deliveredEmbed],
        },
        id
      );
      if (order.trainingSession) {
        await trainingOrderDelivered(order.trainingSession);
      }
      break;
    case orderStatus.REJECTED:
      order = await updateOrder(
        id,
        {
          status,
          rejectorId: chef,
          rejectedReason: p.reason,
        },
        true
      );
      const orderRejectionEmbed = new EmbedBuilder()
        .setTitle(`Order from **${order.customerUsername}**`)
        .setDescription(order.order)
        .addFields([
          { name: "Reason", value: p.reason },
          { name: "Rejected by", value: `<@!${chef}>` },
        ])
        .setFooter({ text: `Order ID: ${id}` });
      await sendKitchenMessage(
        KitchenChannel.cancelledOrders,
        {
          embeds: [orderRejectionEmbed],
        },
        id
      );
  }

  //ABANDONMENT JOBS
  if (status == orderStatus.FILLING || status == orderStatus.DELIVERING) {
    await agenda.schedule<OrderReminderJob>("in 5 minutes", "order reminder", {
      orderId: id,
    });
  }

  //CUSTOMER STATUS MESSAGE
  let message = "";
  switch (status) {
    case orderStatus.FILLING:
      message = L[locale].CUSTOMER_STATUS_MESSAGE.FILLING({
        chef: chefUsername,
      });
      break;
    case orderStatus.PACKING:
      const timestampIn5Minutes = new Date(Date.now() + 5 * 60 * 1000);
      message = L[locale].CUSTOMER_STATUS_MESSAGE.PACKING({
        timestamp: `<t:${Math.round(
          timestampIn5Minutes.getTime() / 1000
        ).toString()}:R>`,
      });
      break;
    case orderStatus.PACKED:
      message = L[locale].CUSTOMER_STATUS_MESSAGE.PACKED();
      break;
    case orderStatus.DELIVERING:
      message = L[locale].CUSTOMER_STATUS_MESSAGE.DELIVERING({
        deliverer: chefUsername,
      });
      break;
    case orderStatus.DELIVERED:
      message = L[locale].CUSTOMER_STATUS_MESSAGE.DELIVERED();
      break;
    case orderStatus.REJECTED:
      message = L[locale].CUSTOMER_STATUS_MESSAGE.REJECTED({
        reason: p.reason,
        link: "https://dsc.kitchen/rules",
      });
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
  await sendLogMessage(emoji, logMessage, admin);

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
export const sendOrderForFilling = async (
  order: order & {
    trainingSession: trainingSession | null;
  },
  updateDB = true
) => {
  await agenda.cancel({ "data.orderId": order.id });

  if (updateDB)
    await updateOrder(order.id, { status: orderStatus.ORDERED }, true);

  const kitchenActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`order:${order.id}:fill`)
      .setLabel("Fill Order")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Reject Order")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`order:${order.id}:reject`)
      .setDisabled(order.trainingSession ? true : false),
  ]);
  const kitchenEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });

  const ping = order.trainingSession
    ? `<@!${order.trainingSession.user}>`
    : `<@&${env.ORDER_PING_ROLE_ID}>`;
  await sendKitchenMessage(
    order.trainingSession
      ? KitchenChannel.training_orders
      : KitchenChannel.orders,
    {
      embeds: [kitchenEmbed],
      components: [kitchenActionRow],
      content: ping,
    },
    order.id
  );

  await updateOrderStatusMessage(
    order,
    L[order.locale as SupportedLocale].CUSTOMER_STATUS_MESSAGE.ORDERED({
      id: order.id,
    })
  );
};
