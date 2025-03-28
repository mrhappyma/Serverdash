import { Job, JobAttributesData } from "agenda";
import agenda from "./jobs";
import { getOrder } from "../orders/cache";
import { KitchenChannel } from "../utils/kitchenChannels";
import { messagesClient } from "..";
import env from "../utils/env";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from "discord.js";
import { orderStatus } from "@prisma/client";
import updateOrderStatus, { sendOrderForFilling } from "../orders/updateStatus";

export interface OrderReminderJob extends JobAttributesData {
  orderId: number;
}
agenda.define<OrderReminderJob>(
  "order reminder",
  async (job: Job<OrderReminderJob>) => {
    const order = await getOrder(job.attrs.data.orderId);
    if (!order) throw new Error("Order not found");

    const target =
      order.status == orderStatus.FILLING ? order.chefId : order.deliveryId;
    if (!target) throw new Error("No target found");

    const targetMessage = order.relatedKitchenMessages.find((m) =>
      m.startsWith(
        order.status == orderStatus.FILLING
          ? KitchenChannel.orders.toString()
          : KitchenChannel.deliveries.toString()
      )
    );
    if (!targetMessage) throw new Error("No target message found");

    const channel = (await messagesClient.client.channels.fetch(
      order.status == orderStatus.FILLING
        ? env.NEW_ORDERS_CHANNEL_ID
        : env.READY_ORDERS_CHANNEL_ID
    )) as TextChannel;
    const message = await channel.messages.fetch(targetMessage.split(":")[1]);

    const thread =
      message.thread ??
      (await message.startThread({
        name: `Order ${order.id}`,
        reason: "Order reminder",
      }));

    const reminder = await thread.send({
      content: `### <@!${target}>, still working on order #${order.id}?\nIf you don't respond within 2 minutes, I'll unclaim it for you.`,
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`order:${order.id}:reminder:ack`)
            .setLabel("Still working on it!")
            .setStyle(ButtonStyle.Primary)
        ),
      ],
    });

    await agenda.schedule<OrderAbandonedJob>(
      "in 2 minutes",
      "order abandoned",
      {
        orderId: order.id,
        reminderMessageId: reminder.id,
        threadId: thread.id,
      }
    );
  }
);

messagesClient.registerButton(
  "order:(\\d+):reminder:ack",
  async (interaction) => {
    const id = parseInt(interaction.customId.split(":")[1]);
    const order = await getOrder(id);
    if (
      !order ||
      (order.status == orderStatus.FILLING &&
        order.chefId != interaction.user.id) ||
      (order.status == orderStatus.DELIVERING &&
        order.deliveryId != interaction.user.id)
    ) {
      await interaction.reply({
        content: "this isn't your order >:(",
        ephemeral: true,
      });
      return;
    }
    await agenda.cancel({
      name: "order abandoned",
      "data.orderId": id,
    });
    await agenda.schedule<OrderReminderJob>("in 5 minutes", "order reminder", {
      orderId: id,
    });
    await interaction.update({
      content: "Got it! I'll pester you again in another 5 minutes.",
      components: [],
    });
  }
);

export interface OrderAbandonedJob extends JobAttributesData {
  orderId: number;
  reminderMessageId: string;
  threadId: string;
}
agenda.define<OrderAbandonedJob>(
  "order abandoned",
  async (job: Job<OrderAbandonedJob>) => {
    const order = await getOrder(job.attrs.data.orderId);
    if (!order) throw new Error("Order not found");

    const channel = (await messagesClient.client.channels.fetch(
      job.attrs.data.threadId
    )) as TextChannel;
    const message = await channel.messages.fetch(
      job.attrs.data.reminderMessageId
    );
    await message.edit({
      content: `${message.content}\n\nOrder abandoned :(`,
      components: [],
    });

    if (
      order.status != orderStatus.FILLING &&
      order.status != orderStatus.DELIVERING
    )
      throw new Error("Order not in filling or delivering status");

    switch (order.status) {
      case orderStatus.FILLING:
        await sendOrderForFilling(order);
        break;
      case orderStatus.DELIVERING:
        await updateOrderStatus({
          id: order.id,
          status: orderStatus.PACKED,
          chef: messagesClient.client.user!.id,
          chefUsername: messagesClient.client.user!.username,
          admin: messagesClient.client.user!.id,
        });
        break;
    }
  }
);
