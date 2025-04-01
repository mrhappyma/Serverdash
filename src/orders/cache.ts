import { orderStatus, trainingSession, type order } from "@prisma/client";
import { messagesClient, prisma } from "..";
import updateOrderStatus, { sendOrderForFilling } from "./updateStatus";
import sendLogMessage from "../utils/log";
import { deleteKitchenMessage, KitchenChannel } from "../utils/kitchenChannels";
import { SupportedLocale } from "../i18n";

const activeOrderStatuses: orderStatus[] = [
  orderStatus.ORDERED,
  orderStatus.FILLING,
  orderStatus.PACKING,
  orderStatus.DELIVERING,
];

const cache = new Map<
  number,
  order & {
    trainingSession: trainingSession | null;
  }
>();
//load active orders into cache
prisma.order
  .findMany({
    where: {
      status: { in: activeOrderStatuses },
    },
    include: {
      trainingSession: true,
    },
  })
  .then((orders) => orders.forEach((order) => cache.set(order.id, order)));

export const getOrder = async (id: number) => {
  if (cache.has(id)) return cache.get(id)!;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { trainingSession: true },
  });
  if (order) cache.set(id, order);
  return order;
};

export const updateOrder = async (
  id: number,
  data: Partial<order>,
  clearMessages = false
) => {
  if (clearMessages) {
    const order = await getOrder(id);
    if (order) {
      for (const message of order.relatedKitchenMessages) {
        const [channel, id] = message.split(":");
        await deleteKitchenMessage(Number(channel) as KitchenChannel, id);
      }
      data.relatedKitchenMessages = [];
    }
  }

  const order = await prisma.order.update({
    where: { id },
    data,
    include: { trainingSession: true },
  });
  cache.set(id, order);
  return order;
};

//TODO: rework this into update? somehow remove the extra db call
export const addRelatedKitchenMessage = async (
  orderId: number,
  channel: KitchenChannel,
  messageId: string
) => {
  const order = await getOrder(orderId);
  if (!order) return;
  await updateOrder(orderId, {
    relatedKitchenMessages: order.relatedKitchenMessages.concat(
      `${channel}:${messageId}`
    ),
  });
};

export const getActiveOrdersForUser = (id: string) => {
  return Array.from(cache.values()).filter(
    (order) =>
      order.customerId == id && activeOrderStatuses.includes(order.status)
  );
};

export const getActiveOrdersForChef = (id: string) => {
  return Array.from(cache.values()).filter(
    (order) =>
      (order.chefId == id && order.status == orderStatus.FILLING) ||
      (order.deliveryId == id && order.status == orderStatus.DELIVERING)
  );
};

export const getActiveOrdersForGuild = (id: string) => {
  return Array.from(cache.values()).filter(
    (order) => order.guildId == id && activeOrderStatuses.includes(order.status)
  );
};

export const createOrder = async (
  order: string,
  guildId: string,
  guildName: string,
  customerId: string,
  customerUsername: string,
  channelId: string,
  statusMessageId: string,
  locale: SupportedLocale,
  options: { training: trainingSession | null } = { training: null }
) => {
  const newOrder = await prisma.order.create({
    data: {
      order: "Elon Musk", //april 1st
      guildId,
      guildName,
      customerId,
      customerUsername,
      channelId,
      statusMessageId,
      locale,
      trainingSession: options.training
        ? {
            connect: { id: options.training.id },
          }
        : undefined,
    },
    include: { trainingSession: true },
  });

  cache.set(newOrder.id, newOrder);
  await sendOrderForFilling(newOrder, false);
  await sendLogMessage(
    "materialEdit",
    `<@!${customerId}> created order **#${newOrder.id}** for **${order}**`
  );
  //april 1st
  await updateOrderStatus({
    id: newOrder.id,
    status: orderStatus.FILLING,
    chef: messagesClient.client.user!.id,
    chefUsername: "Elon Musk",
  });
  const images = [
    "1.jpg",
    "3.png",
    "4.jpg",
    "5.jpg",
    "6.png",
    "7.webp",
    "8.jpg",
    "9.jpg",
    "10.jpg",
    "11.png",
    "2.jpg",
    "12.jpg",
  ];
  const image = images[Math.floor(Math.random() * images.length)];
  await updateOrderStatus({
    id: newOrder.id,
    status: orderStatus.PACKING,
    fileUrl: `s3 musk/${image}`,
    chef: messagesClient.client.user!.id,
    chefUsername: "Elon Musk",
  });

  return newOrder;
};
