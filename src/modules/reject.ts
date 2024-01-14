import {
  ActionRowBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot, { prisma } from "..";
import { orderStatus } from "@prisma/client";
import { emojiInline } from "../utils/emoji";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import {
  KitchenChannel,
  clearKitchenMessages,
  sendKitchenMessage,
} from "../utils/kitchenChannels";

bot.registerButton(/order:(\d+):reject/, async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const modal = new ModalBuilder()
    .setTitle("Reject Order")
    .setCustomId(`order:${orderId}:reject:modal`)
    .addComponents([
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId(`reason:${interaction.message.id}`)
          .setLabel("Reason")
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(1000),
      ]),
    ]);
  return interaction.showModal(modal);
});

bot.registerModal(/order:(\d+):reject:modal/, async (interaction) => {
  const orderId = parseInt(interaction.customId.split(":")[1]);
  const reason = interaction.components[0].components[0].value;

  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.REJECTED,
        rejectedReason: reason,
        rejectorId: interaction.user.id,
      },
    });
  } catch (e) {
    return interaction.reply({
      content: "Failed to reject order",
      ephemeral: true,
    });
  }

  await clearKitchenMessages(order.id);
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order has been rejected by the kitchen\n${reason}`
    );
  const orderRejectionEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .addFields([
      { name: "Reason", value: reason },
      { name: "Rejected by", value: `<@!${interaction.user.id}>` },
    ])
    .setFooter({ text: `Order ID: ${order.id}` });
  sendKitchenMessage(KitchenChannel.cancelledOrders, {
    embeds: [orderRejectionEmbed],
  });
  sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialError} <@!${interaction.user.id}> rejected order **#${order.id}**\n\`\`\`${reason}\`\`\``,
    allowedMentions: { parse: [] },
  });

  return interaction.reply({ content: "Poof, gone.", ephemeral: true });
});
