import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import bot, { prisma } from "..";
import { orderStatus, order } from "@prisma/client";
import { emojiInline } from "../utils/emoji";
import fillOrderMessage, { fileUrl } from "../utils/fillOrderMessage";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import {
  KitchenChannel,
  clearKitchenMessages,
  editKitchenMessage,
  sendKitchenMessage,
} from "../utils/kitchenChannels";
import { updateProcessingOrders } from "./metrics";
import env from "../utils/env";

const sendDeliveryContent = async (
  o: order,
  i: ButtonInteraction,
  m?: string
) => {
  const chefRecord = await prisma.chef.upsert({
    where: {
      id: i.user.id,
    },
    update: {},
    create: {
      id: i.user.id,
      message:
        "Hey $mention! Here's your order, prepared by the lovely @$chef! $item",
    },
  });

  const actionRowMessage = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setLabel("toggle codeblock")
      .setStyle(ButtonStyle.Primary)
      .setCustomId(`toggle_backticks`),
  ]);
  await i.followUp({
    content: `<#${o.channelId}>\n${o.invite}`,
    ephemeral: true,
  });
  await i.followUp({
    content: chefRecord.backticks
      ? `\`\`\`\n${fillOrderMessage(o, chefRecord.message)}\n\`\`\``
      : fillOrderMessage(o, chefRecord.message),
    ephemeral: true,
    components: [actionRowMessage],
  });
};

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
  if (
    orderP.customerId == interaction.user.id &&
    !env.DEVELOPERS.split(" ").includes(interaction.user.id)
  ) {
    return interaction.followUp({
      content: "you ordered this! who are you gonna deliver to, yourself?",
      ephemeral: true,
    });
  }

  try {
    var guild = await bot.client.guilds.fetch(orderP.guildId);
  } catch (e) {
    return interaction.followUp({
      content: `Failed to fetch guild! This usually means the bot was kicked, and if so just reject the order. Here's the error:\n\`\`\`${e}\`\`\``,
      ephemeral: true,
    });
  }
  const targetChannel = guild.channels.cache.get(orderP.channelId);
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
  var order = await prisma.order.update({
    where: {
      id: orderId,
    },
    data: {
      status: orderStatus.DELIVERING,
      deliveryId: interaction.user.id,
      deliveryUsername: interaction.user.username,
      invite: invite.url,
    },
  });
  updateProcessingOrders(orderStatus.DELIVERING, order.id);

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
      new ButtonBuilder()
        .setLabel("Get Content")
        .setStyle(ButtonStyle.Secondary)
        .setCustomId(`order:${order.id}:content`),
    ]);
  const deliveringEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  const deliveringOrderMessage = await editKitchenMessage(
    KitchenChannel.deliveries,
    interaction.message.id,
    {
      embeds: [deliveringEmbed],
      components: [deliveringActionRow],
      content: `<@!${order.deliveryId}>`,
    }
  );

  await sendDeliveryContent(order, interaction, deliveringOrderMessage.id);

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
    updateProcessingOrders(orderStatus.DELIVERED, order.id);
  } catch (e) {
    return { success: false, message: "Failed to mark delivery finished" };
  }
  await clearKitchenMessages(order.id);
  await interaction.deferReply({ ephemeral: true });

  const isImage =
    order.fileUrl?.endsWith(".png") ||
    order.fileUrl?.endsWith(".jpg") ||
    order.fileUrl?.endsWith(".jpeg") ||
    order.fileUrl?.endsWith(".gif") ||
    order.fileUrl?.endsWith(".webp");

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
  isImage ? deliveredEmbed.setImage(fileUrl(order.fileUrl!)!) : null;
  await sendKitchenMessage(KitchenChannel.deliveredOrders, {
    content: fileUrl(order.fileUrl!) ?? undefined,
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

bot.registerButton(/order:(\d+):content/, async (interaction) => {
  await interaction.deferUpdate();

  const orderId = parseInt(interaction.customId.split(":")[1]);
  const order = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
  if (!order)
    return interaction.followUp({
      content: "Failed to fetch order :(",
      ephemeral: true,
    });
  if (order.deliveryId != interaction.user.id)
    return interaction.followUp({
      content: "Nice try, but this isn't your order!",
      ephemeral: true,
    });

  await sendDeliveryContent(order, interaction);
});
