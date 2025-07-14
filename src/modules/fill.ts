import bot from "..";
import { orderStatus } from "@prisma/client";
import { emojiInline } from "../utils/emoji";
import { KitchenChannel, sendKitchenMessage } from "../utils/kitchenChannels";
import { getOrder } from "../orders/cache";
import updateOrderStatus, { sendOrderForFilling } from "../orders/updateStatus";
import { MessageFlags } from "discord.js";

bot.registerButton("order:(\\d+):fill", async (interaction) => {
  const update = await updateOrderStatus({
    id: parseInt(interaction.customId.split(":")[1]),
    status: orderStatus.FILLING,
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
  }
});

//todo: refactor to share more logic with order creation
bot.registerButton("order:(\\d+):drop", async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const order = await getOrder(parseInt(orderId));
  if (!order)
    return interaction.reply({
      content: "Order not found",
      flags: [MessageFlags.Ephemeral],
    });
  if (order.chefId !== interaction.user.id)
    return interaction.reply({
      content: "Nice try, but this isn't your order!",
      flags: [MessageFlags.Ephemeral],
    });
  if (order.status !== orderStatus.FILLING)
    return interaction.reply({
      content: "Can't unclaim order- status is not FILLING",
      flags: [MessageFlags.Ephemeral],
    });

  await sendOrderForFilling(order);
  await interaction.deferUpdate();

  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialDelete} <@!${interaction.user.id}> dropped order **#${order.id}**.`,
    allowedMentions: { parse: [] },
  });
});
