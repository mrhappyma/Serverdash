import { WebhookClient, WebhookMessageCreateOptions } from "discord.js";
import env from "./env";
import bot, { prisma } from "..";

export const enum KitchenChannel {
  orders = 0,
  readyOrders = 2,
  deliveringOrders = 3,
  deliveredOrders = 4,
  cancelledOrders = 5,
  logs = 6,
  chefChat = 7,
  applications = 8,
}

const webhooks = {
  [KitchenChannel.orders]: new WebhookClient({
    url: env.NEW_ORDERS_WEBHOOK,
  }),
  [KitchenChannel.readyOrders]: new WebhookClient({
    url: env.READY_ORDERS_WEBHOOK,
  }),
  [KitchenChannel.deliveringOrders]: new WebhookClient({
    url: env.DELIVERING_ORDERS_WEBHOOK,
  }),
  [KitchenChannel.deliveredOrders]: new WebhookClient({
    url: env.DELIVERED_ORDERS_WEBHOOK,
  }),
  [KitchenChannel.cancelledOrders]: new WebhookClient({
    url: env.CANCELLED_ORDERS_WEBHOOK,
  }),
  [KitchenChannel.logs]: new WebhookClient({ url: env.LOGS_WEBHOOK }),
  [KitchenChannel.chefChat]: new WebhookClient({ url: env.CHEF_CHAT_WEBHOOK }),
  [KitchenChannel.applications]: new WebhookClient({
    url: env.APPLICATIONS_WEBHOOK,
  }),
};

/**
 * @param order optional order id, add to relatedKitchenMessages. only include if this message should be cleared when the order's status changes.
 */
export const sendKitchenMessage = async (
  channel: KitchenChannel,
  content: WebhookMessageCreateOptions,
  order?: number
) => {
  const webhook = webhooks[channel];
  const message = await webhook.send({
    username: bot.client.user?.username,
    avatarURL: bot.client.user?.avatarURL() ?? undefined,
    ...content,
  });
  if (order) {
    await prisma.order.update({
      where: {
        id: order,
      },
      data: {
        relatedKitchenMessages: {
          push: `${channel}:${message.id}`,
        },
      },
    });
  }
  return message;
};

export const editKitchenMessage = async (
  channel: KitchenChannel,
  messageId: string,
  content: WebhookMessageCreateOptions
) => {
  const webhook = webhooks[channel];
  return await webhook.editMessage(messageId, {
    username: bot.client.user?.username,
    avatarURL: bot.client.user?.avatarURL() ?? undefined,
    ...content,
  });
};

export const clearKitchenMessages = async (order: number) => {
  const orderRecord = await prisma.order.findUnique({
    where: {
      id: order,
    },
    select: {
      relatedKitchenMessages: true,
    },
  });
  if (!orderRecord) return;
  for (const message of orderRecord.relatedKitchenMessages) {
    const [channel, id] = message.split(":");
    const webhook = webhooks[Number(channel) as KitchenChannel];
    await webhook.deleteMessage(id);
  }
  await prisma.order.update({
    where: {
      id: order,
    },
    data: {
      relatedKitchenMessages: {
        set: [],
      },
    },
  });
};
