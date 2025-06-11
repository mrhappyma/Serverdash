import {
  WebhookClient,
  WebhookMessageCreateOptions,
  WebhookMessageEditOptions,
} from "discord.js";
import env from "./env";
import bot from "..";
import { addRelatedKitchenMessage } from "../orders/cache";

export const enum KitchenChannel {
  orders = 0,
  deliveries = 2,
  deliveredOrders = 4,
  cancelledOrders = 5,
  logs = 6,
  chefChat = 7,
  applications = 8,
  training_orders = 9,
  training_deliveries = 10,
}

const webhooks = {
  [KitchenChannel.orders]: new WebhookClient({
    url: env.NEW_ORDERS_WEBHOOK,
  }),
  [KitchenChannel.deliveries]: new WebhookClient({
    url: env.READY_ORDERS_WEBHOOK,
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
  [KitchenChannel.training_orders]: new WebhookClient({
    url: env.TRAINING_NEW_ORDERS_WEBHOOK,
  }),
  [KitchenChannel.training_deliveries]: new WebhookClient({
    url: env.TRAINING_READY_ORDERS_WEBHOOK,
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
    await addRelatedKitchenMessage(order, channel, message.id);
  }
  return message;
};

export const editKitchenMessage = async (
  channel: KitchenChannel,
  messageId: string,
  content: WebhookMessageEditOptions
) => {
  const webhook = webhooks[channel];
  return await webhook.editMessage(messageId, content);
};

export const deleteKitchenMessage = async (
  channel: KitchenChannel,
  messageId: string
) => {
  try {
    const webhook = webhooks[channel];
    return await webhook.deleteMessage(messageId);
  } catch {}
};
