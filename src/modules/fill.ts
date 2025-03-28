import bot from "..";
import { orderStatus } from "@prisma/client";
import { emojiInline } from "../utils/emoji";
import { KitchenChannel, sendKitchenMessage } from "../utils/kitchenChannels";
import { getOrder } from "../orders/cache";
import updateOrderStatus, { sendOrderForFilling } from "../orders/updateStatus";

bot.registerButton("order:(\\d+):fill", async (interaction) => {
  const update = await updateOrderStatus({
    id: parseInt(interaction.customId.split(":")[1]),
    status: orderStatus.FILLING,
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
  }
});

//todo: refactor to share more logic with order creation
bot.registerButton("order:(\\d+):drop", async (interaction) => {
  const orderId = interaction.customId.split(":")[1];
  const order = await getOrder(parseInt(orderId));
  if (!order)
    return interaction.reply({ content: "Order not found", ephemeral: true });
  if (order.chefId !== interaction.user.id)
    return interaction.reply({
      content: "Nice try, but this isn't your order!",
      ephemeral: true,
    });
  if (order.status !== orderStatus.FILLING)
    return interaction.reply({
      content: "Can't unclaim order- status is not FILLING",
      ephemeral: true,
    });

  await sendOrderForFilling(order);
  await interaction.deferUpdate();

  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialDelete} <@!${interaction.user.id}> dropped order **#${order.id}**.`,
    allowedMentions: { parse: [] },
  });
});
