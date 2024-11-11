import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextBasedChannel,
} from "discord.js";
import bot, { messagesClient, prisma } from "..";
import env from "../utils/env";
import { orderStatus } from "@prisma/client";
import { emojiInline } from "../utils/emoji";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import {
  KitchenChannel,
  clearKitchenMessages,
  sendKitchenMessage,
} from "../utils/kitchenChannels";
import { updateProcessingOrders } from "./metrics";

bot.registerButton("order:(\\d+):fill", async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const ocheck = await prisma.order.findUnique({
    where: {
      id: parseInt(orderId),
    },
  });
  if (!ocheck)
    return interaction.reply({ content: "Order not found", ephemeral: true });
  if (ocheck.status !== orderStatus.ORDERED)
    return interaction.reply({
      content: "Can't claim order- status is not ORDERED",
      ephemeral: true,
    });

  try {
    var order = await prisma.order.update({
      where: {
        id: parseInt(orderId),
      },
      data: {
        status: orderStatus.FILLING,
        chefId: interaction.user.id,
        chefUsername: interaction.user.username,
      },
    });
    updateProcessingOrders(orderStatus.FILLING, order.id);
  } catch (e) {
    return interaction.reply({
      content: "Failed to claim order",
      ephemeral: true,
    });
  }

  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is being filled by ${interaction.user.username}`
    );
  await clearKitchenMessages(order.id);
  const orderFillingActionRow =
    new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setLabel("Reject Order")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`order:${order.id}:reject`),
    ]);
  const orderFillingEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  let orderFillAPIMessage = await sendKitchenMessage(
    KitchenChannel.fillOrders,
    {
      embeds: [orderFillingEmbed],
      components: [orderFillingActionRow],
      content: `<@!${order.chefId}>`,
    },
    order.id
  );
  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialEdit} <@!${interaction.user.id}> claimed order **#${order.id}**`,
    allowedMentions: { parse: [] },
  });
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Jump to thread")
      .setURL(
        `https://discord.com/channels/${env.KITCHEN_SERVER_ID}/${env.FILL_ORDERS_CHANNEL_ID}/threads/${orderFillAPIMessage.id}/`
      )
      .setStyle(ButtonStyle.Link),
  ]);
  await interaction.reply({
    content: `Claimed!`,
    components: [actionRow],
    ephemeral: true,
  });
  const fillOrdersChannel = (await messagesClient.client.channels.fetch(
    env.FILL_ORDERS_CHANNEL_ID
  )) as TextBasedChannel;
  const orderFillMessage = await fillOrdersChannel.messages.fetch(
    orderFillAPIMessage.id
  );
  await orderFillMessage.startThread({
    name: `Order #${order.id}`,
    autoArchiveDuration: 60,
    reason: `Order ${order.id} claimed by ${interaction.user.username}`,
  });
});
