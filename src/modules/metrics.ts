import type { OrderStatus } from "aws-sdk/clients/outposts";
import { Gauge, collectDefaultMetrics } from "prom-client";
import { prisma } from "..";
import { orderStatus } from "@prisma/client";

collectDefaultMetrics();

const processingOrders = new Gauge({
  name: "processing_orders",
  help: "Gauge of processing orders",
  labelNames: ["status"],
});

const ordersCache = new Map<number, OrderStatus>();

const initCounters = async () => {
  const orders = await prisma.order.findMany();
  orders.forEach((order) => {
    ordersCache.set(order.id, order.status);
  });
  updateCounts();
};
initCounters();

const updateCounts = () => {
  for (const status of Object.values(orderStatus)) {
    const count = [...ordersCache.entries()].filter(
      ([, s]) => s === status
    ).length;
    processingOrders.set({ status }, count);
  }
};

export const updateProcessingOrders = (
  status: OrderStatus,
  orderNumber: number
) => {
  ordersCache.set(orderNumber, status);
  updateCounts();
};
