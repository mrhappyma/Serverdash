import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "..";
import env from "../utils/env";
import kitchenChannels from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";

const createOrder = async (
  order: string,
  guildId: string,
  guildName: string,
  customerId: string,
  customerUsername: string,
  channelId: string,
  statusMessageId?: string
) => {
  const activeOrders = await prisma.order.findMany({
    where: {
      customerId,
      guildId,
    },
  });
  const activeOrdersFiltered = activeOrders.filter(
    (order) => order.status !== "DELIVERED" && order.status !== "REJECTED"
  );
  if (activeOrdersFiltered.length > 0)
    return { success: false, message: "You already have an active order" };
  try {
    var record = await prisma.order.create({
      data: {
        channelId,
        customerId,
        customerUsername,
        guildId,
        guildName,
        order,
        statusMessageId,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to create order" };
  }
  const newOrdersChannel = await kitchenChannels.newOrdersChannel();
  if (!newOrdersChannel?.isTextBased())
    return { success: false, message: "Failed to fetch new orders channel" };
  const logsChannel = await kitchenChannels.logsChannel();
  if (!logsChannel?.isTextBased())
    return { success: false, message: "Failed to fetch logs channel" };
  const kitchenActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`order:${record.id}:fill`)
      .setLabel("Fill Order")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Reject Order")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`order:${record.id}:reject`),
  ]);
  const kitchenEmbed = new EmbedBuilder()
    .setTitle(`Order from **${customerUsername}**`)
    .setDescription(order)
    .setFooter({ text: `Order ID: ${record.id}` });
  await newOrdersChannel.send({
    embeds: [kitchenEmbed],
    components: [kitchenActionRow],
    content: `<@&${env.ORDER_PING_ROLE_ID}>`,
  });
  await logsChannel.send({
    content: `${emojiInline.materialEdit} <@!${customerId}> created order **#${record.id}** for **${order}**`,
    allowedMentions: { parse: [] },
  });
  return {
    success: true,
    message: `Order ${record.id} has been sent to the kitchen!`,
    id: record.id,
  };
};
export default createOrder;
