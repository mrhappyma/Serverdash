import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import bot, { prisma } from "..";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import env from "../utils/env";
import { orderStatus } from "@prisma/client";

declare type startFillingOrderResponse =
  | {
      success: false;
      message: string;
    }
  | {
      success: true;
      message: string;
      messageId: string;
    };

export const startFillingOrder = async (
  orderId: number,
  chefId: string,
  chefUsername: string
): Promise<startFillingOrderResponse> => {
  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.FILLING,
        chefId: chefId,
        chefUsername: chefUsername,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to start filling order" };
  }
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is being filled by ${chefUsername}`
    );
  const orderFillingChannel = await (
    await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
  ).channels.fetch(env.FILL_ORDERS_CHANNEL_ID);
  if (!orderFillingChannel?.isTextBased())
    return { success: false, message: "Failed to fetch order filling channel" };
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
  const orderFillingMessage = await orderFillingChannel.send({
    embeds: [orderFillingEmbed],
    components: [orderFillingActionRow],
    content: `<@!${chefId}>`,
  });
  return {
    success: true,
    message: `Order ${order.id} is being filled by ${chefUsername}`,
    messageId: orderFillingMessage.id,
  };
};
export default startFillingOrder;
