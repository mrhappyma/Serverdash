import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
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
    flags: [MessageFlags.Ephemeral],
  });
  await i.followUp({
    content: chefRecord.backticks
      ? `\`\`\`\n${fillOrderMessage(o, chefRecord.message)}\n\`\`\``
      : fillOrderMessage(o, chefRecord.message),
    flags: [MessageFlags.Ephemeral],
    components: [actionRowMessage],
  });
};

bot.registerButton(/order:(\d+):deliver/, async (interaction) => {
  const orderId = parseInt(interaction.customId.split(":")[1]);

  const update = await updateOrderStatus({
    id: orderId,
    status: orderStatus.DELIVERING,
    chef: interaction.user.id,
    interactionMessageId: interaction.message.id,
  });

  if (!update.success) {
    await interaction.reply({
      content: update.message,
      flags: [MessageFlags.Ephemeral],
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
  });

  if (!update.success) {
    await interaction.reply({
      content: update.message,
      flags: [MessageFlags.Ephemeral],
    });
  } else {
    await interaction.reply({
      content: `Done! Thanks!`,
      flags: [MessageFlags.Ephemeral],
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
      flags: [MessageFlags.Ephemeral],
    });
  if (order.deliveryId != interaction.user.id)
    return interaction.followUp({
      content: "Nice try, but this isn't your order!",
      flags: [MessageFlags.Ephemeral],
    });

  await sendDeliveryContent(order, interaction);
});
