import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "..";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import { orderStatus } from "@prisma/client";
import kitchenChannels from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";

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
  const orderFillingChannel = await kitchenChannels.fillOrdersChannel();
  if (!orderFillingChannel?.isTextBased())
    return { success: false, message: "Failed to fetch order filling channel" };
  const logsChannel = await kitchenChannels.logsChannel();
  if (!logsChannel?.isTextBased())
    return { success: false, message: "Failed to fetch logs channel" };
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
  await logsChannel.send({
    content: `${emojiInline.materialBlender} <@!${chefId}> claimed order **#${order.id}**`,
    allowedMentions: { parse: [] },
  });
  return {
    success: true,
    message: `Order ${order.id} is being filled by ${chefUsername}`,
    messageId: orderFillingMessage.id,
  };
};
export default startFillingOrder;
