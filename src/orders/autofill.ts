import { order } from "@prisma/client";
import bot from "..";
import { updateOrder } from "./cache";

const getAutoFillFileURL = async (order: order) => {
  const o = order.order;

  if (["really cool cat", "ginkgo", "the mascot"].includes(o.toLowerCase())) {
    const file = await fetch("https://ginkgo-bot.vercel.app/api/ginkgo");
    const response = (await file.json()) as { url: string };
    return response.url as string;
  }

  if (/^<@!?(\d+)>$/.test(o)) {
    const mentionedUserId = o.match(/^<@!?(\d+)>$/)?.[1]!;
    const user = await bot.client.users
      .fetch(mentionedUserId)
      .catch(() => null);
    if (user) {
      await updateOrder(order.id, {
        order: user.globalName || user.username,
      });
      return user.displayAvatarURL();
    }
  }

  if (["me", "myself"].includes(o.toLocaleLowerCase())) {
    const mentionedUserId = order.customerId;
    const user = await bot.client.users
      .fetch(mentionedUserId)
      .catch(() => null);
    if (user) return user.displayAvatarURL();
  }
};

export default getAutoFillFileURL;
