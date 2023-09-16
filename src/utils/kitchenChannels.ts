import bot from "..";
import env from "./env";

export default {
  async newOrdersChannel() {
    return (
      await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
    ).channels.fetch(env.NEW_ORDERS_CHANNEL_ID);
  },
  async fillOrdersChannel() {
    return (
      await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
    ).channels.fetch(env.FILL_ORDERS_CHANNEL_ID);
  },
  async readyOrdersChannel() {
    return await (
      await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
    ).channels.fetch(env.READY_ORDERS_CHANNEL_ID);
  },
  async deliveringOrdersChannel() {
    return (
      await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
    ).channels.fetch(env.DELIVERING_ORDERS_CHANNEL_ID);
  },
  async deliveredOrdersChannel() {
    return (
      await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
    ).channels.fetch(env.DELIVERED_ORDERS_CHANNEL_ID);
  },
  async cancelledOrdersChannel() {
    return (
      await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
    ).channels.fetch(env.CANCELLED_ORDERS_CHANNEL_ID);
  },
  async logsChannel() {
    return (
      await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID)
    ).channels.fetch(env.LOG_CHANNEL_ID);
  },
};
