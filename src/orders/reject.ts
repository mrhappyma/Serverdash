import { orderStatus } from "@prisma/client";
import bot, { prisma } from "..";
import { EmbedBuilder } from "discord.js";
import env from "../utils/env";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";

const rejectOrder = async (id: number, reason: string) => {
  try {
    var order = await prisma.order.update({
      where: {
        id,
      },
      data: {
        status: orderStatus.REJECTED,
        rejectedReason: reason,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to reject order" };
  }
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order has been rejected by the kitchen\n${reason}`
    );
  const orderRejectionsChannel = await (
    await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
  ).channels.fetch(env.CANCELLED_ORDERS_CHANNEL_ID);
  if (!orderRejectionsChannel?.isTextBased())
    return {
      success: false,
      message: "Failed to fetch order rejections channel",
    };
  const orderRejectionEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .addFields([{ name: "Reason", value: reason }])
    .setFooter({ text: `Order ID: ${order.id}` });
  await orderRejectionsChannel.send({ embeds: [orderRejectionEmbed] });
  return {
    success: true,
    message: `Order ${order.id} has been rejected`,
  };
};
export default rejectOrder;
