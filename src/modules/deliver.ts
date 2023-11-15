import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import bot, { prisma } from "..";
import env from "../utils/env";
import { orderStatus } from "@prisma/client";
import { emojiInline } from "../utils/emoji";
import fillOrderMessage from "../utils/fillOrderMessage";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import {
  KitchenChannel,
  clearKitchenMessages,
  sendKitchenMessage,
} from "../utils/kitchenChannels";

bot.registerButton(/order:(\d+):deliver/, async (interaction) => {
  await interaction.deferUpdate();
  const orderId = parseInt(interaction.customId.split(":")[1]);

  const orderP = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
  if (!orderP)
    return interaction.followUp({
      content: "Order not found",
      ephemeral: true,
    });
  if (orderP.status == orderStatus.DELIVERING)
    return interaction.followUp({
      content: "Too slow- somebody's already claimed this order.",
      ephemeral: true,
    });
  if (orderP.status !== orderStatus.PACKED)
    return interaction.followUp({
      content: "Can't start delivery- status is not PACKED",
      ephemeral: true,
    });

  const targetChannel = await (
    await bot.client.guilds.fetch(orderP.guildId)
  ).channels.fetch(orderP.channelId);
  if (!targetChannel?.isTextBased() || targetChannel.isThread())
    return interaction.followUp({ content: "Failed to fetch order channel" });
  try {
    var invite = await targetChannel.createInvite({
      maxAge: 3600,
      maxUses: 1,
      unique: true,
      reason: `Order #${orderP.id} delivery invite`,
    });
  } catch (e) {
    return interaction.followUp({
      content: "Failed to create invite",
      ephemeral: true,
    });
  }
  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.DELIVERING,
        deliveryId: interaction.user.id,
        deliveryUsername: interaction.user.username,
      },
    });
  } catch (e) {
    return interaction.followUp({
      content: "Failed to start delivery",
      ephemeral: true,
    });
  }

  await clearKitchenMessages(order.id);
  const deliveringActionRow =
    new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(`order:${order.id}:complete`)
        .setLabel("Complete Order")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("Reject Order")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`order:${order.id}:reject`),
    ]);
  const deliveringEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  const deliveringOrderMessage = await sendKitchenMessage(
    KitchenChannel.deliveringOrders,
    {
      embeds: [deliveringEmbed],
      components: [deliveringActionRow],
      content: `<@!${order.deliveryId}>`,
    },
    order.id
  );

  const chefRecord = await prisma.chef.upsert({
    where: {
      id: interaction.user.id,
    },
    update: {},
    create: {
      id: interaction.user.id,
      message: "Hey $mention! Here's your order! $item",
    },
  });
  const actionRowInvite = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("Jump to buttons")
      .setURL(
        `https://discord.com/channels/${env.KITCHEN_SERVER_ID}/${env.DELIVERING_ORDERS_CHANNEL_ID}/${deliveringOrderMessage.id}`
      )
      .setStyle(ButtonStyle.Link),
  ]);
  const actionRowMessage = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("toggle codeblock")
      .setStyle(ButtonStyle.Primary)
      .setCustomId(`toggle_backticks`),
  ]);
  interaction.followUp({
    content: `<#${order.channelId}>\n${invite.url}`,
    components: [actionRowInvite],
    ephemeral: true,
  });
  interaction.followUp({
    content: chefRecord.backticks
      ? `\`\`\`\n${fillOrderMessage(order, chefRecord.message)}\n\`\`\``
      : fillOrderMessage(order, chefRecord.message),
    ephemeral: true,
    components: [actionRowMessage],
  });

  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialPackage2} <@!${interaction.user.id}> started delivering order **#${order.id}**`,
    allowedMentions: { parse: [] },
  });
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is being delivered by ${order.deliveryUsername}`
    );
});

bot.registerButton(/order:(\d+):complete/, async (interaction) => {
  const orderId = parseInt(interaction.customId.split(":")[1]);
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
  if (!order) return { success: false, message: "Failed to fetch order" };
  if (order.deliveryId != interaction.user.id)
    return interaction.reply({
      content: "Nice try, but this isn't your order!",
      ephemeral: true,
    });

  try {
    await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.DELIVERED,
      },
    });
  } catch (e) {
    return { success: false, message: "Failed to mark delivery finished" };
  }
  await clearKitchenMessages(order.id);
  await interaction.deferReply({ ephemeral: true });

  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order has been delivered!`
    );
  const deliveredEmbed = new EmbedBuilder()
    .setTitle(`Order #${order.id}`)
    .setDescription(order.order)
    .addFields([
      {
        name: "Customer",
        value: `<@!${order.customerId}>`,
      },
      {
        name: "Chef",
        value: `<@!${order.chefId}>`,
      },
      {
        name: "Delivery Driver",
        value: `<@!${order.deliveryId}>`,
      },
    ]);
  await sendKitchenMessage(KitchenChannel.deliveredOrders, {
    content: order.fileUrl ?? undefined,
    embeds: [deliveredEmbed],
  });
  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialLocalPostOffice} <@!${order.deliveryId}> marked order **#${order.id}** delivered`,
    allowedMentions: { parse: [] },
  });
  return interaction.editReply({ content: "Done! Thanks!" });
});

bot.registerButton("toggle_backticks", async (interaction) => {
  if (
    interaction.message.content.startsWith("```") &&
    interaction.message.content.endsWith("```")
  ) {
    await prisma.chef.update({
      where: {
        id: interaction.user.id,
      },
      data: {
        backticks: false,
      },
    });
    return interaction.update({
      content: interaction.message.content.slice(3, -3),
      components: interaction.message.components,
    });
  } else {
    await prisma.chef.update({
      where: {
        id: interaction.user.id,
      },
      data: {
        backticks: true,
      },
    });
    return interaction.update({
      content: `\`\`\`\n${interaction.message.content}\n\`\`\``,
      components: interaction.message.components,
    });
  }
});
