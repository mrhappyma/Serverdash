import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import bot, { prisma } from "..";
import env from "../utils/env";

const createOrder = async (
  order: string,
  guildId: string,
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
        order,
        statusMessageId,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to create order" };
  }
  const newOrdersChannel = await (
    await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
  ).channels.fetch(env.NEW_ORDERS_CHANNEL_ID);
  if (!newOrdersChannel?.isTextBased())
    return { success: false, message: "Failed to fetch new orders channel" };
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
  });
  return {
    success: true,
    message: `Order ${record.id} has been sent to the kitchen!`,
    id: record.id,
  };
};
export default createOrder;
