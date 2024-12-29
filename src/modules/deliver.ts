import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
} from "discord.js";
import bot, { prisma } from "..";
import { orderStatus, order } from "@prisma/client";
import fillOrderMessage from "../utils/fillOrderMessage";
import updateOrderStatus from "../orders/updateStatus";
import { getOrder } from "../orders/cache";

const sendDeliveryContent = async (o: order, i: ButtonInteraction) => {
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
  const orderId = parseInt(interaction.customId.split(":")[1]);

  const update = await updateOrderStatus({
    id: orderId,
    status: orderStatus.DELIVERING,
    chef: interaction.user.id,
    chefUsername: interaction.user.username,
    interactionMessageId: interaction.message.id,
  });

  if (!update.success) {
    await interaction.reply({
      content: update.message,
      ephemeral: true,
    });
  } else {
    await interaction.deferUpdate();
    await sendDeliveryContent(update.order, interaction);
  }
});

bot.registerButton(/order:(\d+):complete/, async (interaction) => {
  const orderId = parseInt(interaction.customId.split(":")[1]);

  const update = await updateOrderStatus({
    id: orderId,
    status: orderStatus.DELIVERED,
    chef: interaction.user.id,
    chefUsername: interaction.user.username,
  });

  if (!update.success) {
    await interaction.reply({
      content: update.message,
      ephemeral: true,
    });
  } else {
    await interaction.reply({
      content: `Done! Thanks!`,
      ephemeral: true,
    });
  }
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
  const order = await getOrder(orderId);
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
