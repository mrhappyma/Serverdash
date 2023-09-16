import { orderStatus } from "@prisma/client";
import { prisma } from "..";
import { EmbedBuilder } from "discord.js";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import kitchenChannels from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";

const rejectOrder = async (id: number, reason: string, rejector: string) => {
  try {
    var order = await prisma.order.update({
      where: {
        id,
      },
      data: {
        status: orderStatus.REJECTED,
        rejectedReason: reason,
        rejectorId: rejector,
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
  const orderRejectionsChannel = await kitchenChannels.cancelledOrdersChannel();
  if (!orderRejectionsChannel?.isTextBased())
    return {
      success: false,
      message: "Failed to fetch order rejections channel",
    };
  const logsChannel = await kitchenChannels.logsChannel();
  if (!logsChannel?.isTextBased())
    return { success: false, message: "Failed to fetch logs channel" };
  const orderRejectionEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .addFields([
      { name: "Reason", value: reason },
      { name: "Rejected by", value: `<@!${rejector}>` },
    ])
    .setFooter({ text: `Order ID: ${order.id}` });
  await orderRejectionsChannel.send({ embeds: [orderRejectionEmbed] });
  await logsChannel.send({
    content: `${emojiInline.materialError} <@!${rejector}> rejected order **#${id}**\n\`\`\`${reason}\`\`\``,
    allowedMentions: { parse: [] },
  });
  return {
    success: true,
    message: `Order ${order.id} has been rejected`,
  };
};
export default rejectOrder;
