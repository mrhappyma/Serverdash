import bot from "..";
import { order } from "@prisma/client";

const updateOrderStatusMessage = async (order: order, message: string) => {
  const orderChannel = await (
    await bot.client.guilds.fetch(order.guildId)
  ).channels.fetch(order.channelId);
  if (!orderChannel?.isTextBased()) return false;
  const orderMessage = await orderChannel.messages.fetch(order.statusMessageId);

  orderMessage.edit({
    embeds: [
      {
        title: `Order status - ${order.order}`,
        description: message,
        footer: {
          text: `Order #${order.id} | This message will be updated as your order is filled`,
        },
      },
    ],
  });
};
export default updateOrderStatusMessage;
