import bot from "..";
import { order } from "@prisma/client";

const messages = [
  "Help support the bot by voting on top.gg! https://dsc.kitchen/vote/top.gg",
  "This message will be updated as your order is filled",
  "If you have any questions, please join the kitchen server: https://dsc.kitchen/kitchen",
  "Serverdash is open source! Check out the code on GitHub: https://dsc.kitchen/git",
  "Want to help us fill orders? Join the kitchen server to apply! https://dsc.kitchen/kitchen",
  "All our chefs are volunteers! Please be patient as they work to fill your order",
  "Chefs are required to leave your server after they've finished delivering an order. Please let us know if you have any issues",
  "If you have any suggestions or feedback, please run /feedback to let us know!",
  "Need help? Run /help to learn more about the bot",
  "please send me suggestions for more messages to put here i'm running out of ideas ",
];

const updateOrderStatusMessage = async (order: order, message: string) => {
  const footerMessage = messages[Math.floor(Math.random() * messages.length)];

  try {
    const orderChannel = await (
      await bot.client.guilds.fetch(order.guildId)
    ).channels.fetch(order.channelId);
    if (!orderChannel?.isTextBased()) return false;
    const orderMessage = await orderChannel.messages.fetch(
      order.statusMessageId
    );

    orderMessage.edit({
      embeds: [
        {
          title: `Order status - ${order.order}`,
          description: message,
          footer: {
            text: `Order #${order.id} | ${footerMessage}`,
          },
        },
      ],
    });
  } catch {
    return false;
  }
};
export default updateOrderStatusMessage;
