import bot from "..";
import { order } from "@prisma/client";
import L, { SupportedLocale } from "../i18n";

const updateOrderStatusMessage = async (order: order, message: string) => {
  const locale = order.locale as SupportedLocale;
  const messagesLength =
    L[locale].CUSTOMER_STATUS_MESSAGE.FOOTER_MESSAGES.length;
  const footerMessage =
    L[locale].CUSTOMER_STATUS_MESSAGE.FOOTER_MESSAGES[
      Math.floor(Math.random() * messagesLength)
    ]();

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
          title: L[locale].CUSTOMER_STATUS_MESSAGE.TITLE({
            order: order.order,
          }),
          description: message,
          footer: {
            text: L[locale].CUSTOMER_STATUS_MESSAGE.FOOTER_TEXT({
              order: order.id,
              message: footerMessage,
            }),
          },
        },
      ],
    });
  } catch {
    return false;
  }
};
export default updateOrderStatusMessage;
