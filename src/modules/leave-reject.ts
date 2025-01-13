import { orderStatus } from "@prisma/client";
import bot from "..";
import { getActiveOrdersForGuild } from "../orders/cache";
import updateOrderStatus from "../orders/updateStatus";

bot.client.on("guildDelete", async (guild) => {
  const orders = getActiveOrdersForGuild(guild.id);
  for (const order of orders) {
    await updateOrderStatus({
      id: order.id,
      status: orderStatus.REJECTED,
      chef: bot.client.user!.id,
      reason: "Guild became unavailable",
    });
  }
});
