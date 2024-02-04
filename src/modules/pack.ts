import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot, { prisma } from "..";
import env from "../utils/env";
import { orderStatus } from "@prisma/client";
import { emojiInline } from "../utils/emoji";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import {
  KitchenChannel,
  clearKitchenMessages,
  sendKitchenMessage,
} from "../utils/kitchenChannels";

bot.registerButton(/order:(\d+):pack/, async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const modal = new ModalBuilder()
    .setTitle("Pack Order")
    .setCustomId(`order:${orderId}:pack:modal`)
    .addComponents([
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId(`url:${interaction.message.id}`)
          .setLabel("File URL")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setMaxLength(1000),
      ]),
    ]);
  return interaction.showModal(modal);
});

bot.registerModal(/order:(\d+):pack:modal/, async (interaction) => {
  const orderId = parseInt(interaction.customId.split(":")[1]);
  const url = interaction.components[0].components[0].value;
  interaction.components[0].components[0].customId.split(":")[1];

  const orderP = await prisma.order.findUnique({
    where: {
      id: orderId,
    },
  });
  if (!orderP)
    return interaction.reply({ content: "Order not found", ephemeral: true });
  if (orderP.chefId !== interaction.user.id)
    return interaction.reply({
      content: "Hey, this is someone else's order! Go get your own!",
      ephemeral: true,
    });

  await interaction.deferReply({ ephemeral: true });
  try {
    var request = await fetch(url);
  } catch (e) {
    return interaction.editReply({ content: "Failed to fetch image" });
  }
  if (!request.ok)
    return interaction.editReply({ content: "Failed to fetch image" });
  const allowedContentTypes = [
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "video/webm",
    "video/mp4",
  ];
  if (
    !allowedContentTypes.includes(request.headers.get("content-type") ?? "") &&
    !url.startsWith("https://youtu.be/") &&
    !url.startsWith("https://wikihow.com/")
  )
    return interaction.editReply({ content: "Invalid file type" });

  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.PACKING,
        fileUrl: url,
      },
    });
  } catch (e) {
    return interaction.editReply({ content: "Failed to pack order" });
  }
  setTimeout(() => finishPackOrder(orderId), 1000 * 60 * 5);
  clearKitchenMessages(orderId);

  const timestampIn5Minutes = new Date(Date.now() + 5 * 60 * 1000);
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is being packed! It will be done <t:${Math.round(
        timestampIn5Minutes.getTime() / 1000
      ).toString()}:R>`
    );
  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialLunchDining} <@!${interaction.user.id}> finished packing order **#${orderId}**`,
    allowedMentions: { parse: [] },
  });
  return interaction.editReply({
    content: "Done and sent off for packing 📦",
  });
});

export const finishPackOrder = async (orderId: number) => {
  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.PACKED,
      },
    });
  } catch (e) {
    sendKitchenMessage(KitchenChannel.logs, {
      content: `:x: Failed to finish packing order ${orderId}!! <@!${
        env.DEVELOPERS.split(" ")[0]
      }> go fix`,
    });
    return { success: false, message: "Failed to finish packing order" };
  }

  const deliveryActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    [
      new ButtonBuilder()
        .setCustomId(`order:${order.id}:deliver`)
        .setLabel("Deliver Order")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("Reject Order")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`order:${order.id}:reject`),
    ]
  );
  const deliveryEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  await sendKitchenMessage(
    KitchenChannel.readyOrders,
    {
      embeds: [deliveryEmbed],
      components: [deliveryActionRow],
      content: `<@&${env.DELIVERY_PING_ROLE_ID}>`,
    },
    order.id
  );
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is ready for delivery!`
    );
  return true;
};
