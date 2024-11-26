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
  editKitchenMessage,
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
  const orderFillingActionRow =
    new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(`order:${order.id}:drop`)
        .setLabel("Unclaim Order")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setLabel("Reject Order")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`order:${order.id}:reject`),
    ]);
  const orderFillingEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  await editKitchenMessage(KitchenChannel.orders, interaction.message.id, {
    embeds: [orderFillingEmbed],
    components: [orderFillingActionRow],
    content: `<@!${order.chefId}>`,
  });
  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialEdit} <@!${interaction.user.id}> claimed order **#${order.id}**`,
    allowedMentions: { parse: [] },
  });
  await interaction.deferUpdate();
  const ordersChannel = (await messagesClient.client.channels.fetch(
    env.NEW_ORDERS_CHANNEL_ID
  )) as TextBasedChannel;
  const orderFillMessage = await ordersChannel.messages.fetch(
    interaction.message.id
  );
  await orderFillMessage.startThread({
    name: `Order #${order.id}`,
    autoArchiveDuration: 60,
    reason: `Order ${order.id} claimed by ${interaction.user.username}`,
  });
});

//todo: refactor to share more logic with order creation
bot.registerButton("order:(\\d+):drop", async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const order = await prisma.order.findUnique({
    where: {
      id: parseInt(orderId),
    },
  });
  if (!order)
    return interaction.reply({ content: "Order not found", ephemeral: true });
  if (order.chefId !== interaction.user.id && !(env.DEVELOPERS.split(" ").includes(interaction.user.id)))
    return interaction.reply({
      content: "Nice try, but this isn't your order!",
      ephemeral: true,
    });
  if (order.status !== orderStatus.FILLING)
    return interaction.reply({
      content: "Can't unclaim order- status is not FILLING",
      ephemeral: true,
    });
  await prisma.order.update({
    where: {
      id: parseInt(orderId),
    },
    data: {
      status: orderStatus.ORDERED,
      chefId: null,
      chefUsername: null,
    },
  });
  updateProcessingOrders(orderStatus.ORDERED, order.id);
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Order ${order.id} has been sent to the kitchen!`
    );
  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialDelete} <@!${interaction.user.id}> dropped order **#${order.id}**.`,
    allowedMentions: { parse: [] },
  });
  interaction.deferUpdate();
  await clearKitchenMessages(order.id);
  const kitchenActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`order:${order.id}:fill`)
      .setLabel("Fill Order")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setLabel("Reject Order")
      .setStyle(ButtonStyle.Danger)
      .setCustomId(`order:${order.id}:reject`),
  ]);
  const kitchenEmbed = new EmbedBuilder()
    .setTitle(`Order from **${interaction.user.username}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  await sendKitchenMessage(
    KitchenChannel.orders,
    {
      embeds: [kitchenEmbed],
      components: [kitchenActionRow],
      content: `<@&${env.ORDER_PING_ROLE_ID}>`,
    },
    order.id
  );
});
