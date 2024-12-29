import { orderStatus, type order } from "@prisma/client";
import { prisma } from "..";
import { sendOrderForFilling } from "./updateStatus";
import sendLogMessage from "../utils/log";

const activeOrderStatuses: orderStatus[] = [
  orderStatus.ORDERED,
  orderStatus.FILLING,
  orderStatus.PACKING,
  orderStatus.DELIVERING,
];

const cache = new Map<number, order>();
//load active orders into cache
prisma.order
  .findMany({
    where: {
      status: { in: activeOrderStatuses },
    },
  })
  .then((orders) => orders.forEach((order) => cache.set(order.id, order)));

export const getOrder = async (id: number): Promise<order | null> => {
  if (cache.has(id)) return cache.get(id)!;
  const order = await prisma.order.findUnique({ where: { id } });
  if (order) cache.set(id, order);
  return order;
};

export const updateOrder = async (id: number, data: Partial<order>) => {
  const order = await prisma.order.update({ where: { id }, data });
  cache.set(id, order);
  return order;
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

export const createOrder = async (
  order: string,
  guildId: string,
  guildName: string,
  customerId: string,
  customerUsername: string,
  channelId: string,
  statusMessageId: string
) => {
  const newOrder = await prisma.order.create({
    data: {
      order,
      guildId,
      guildName,
      customerId,
      customerUsername,
      channelId,
      statusMessageId,
    },
  });

  cache.set(newOrder.id, newOrder);
  await sendOrderForFilling(newOrder, false);
  await sendLogMessage(
    "materialEdit",
    `<@!${customerId}> created order **#${newOrder.id}** for **${order}**`
  );
};
