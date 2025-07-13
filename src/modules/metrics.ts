import { orderStatus } from "@prisma/client";
import { Gauge, collectDefaultMetrics } from "prom-client";
import { prisma } from "..";

collectDefaultMetrics();

const processingOrders = new Gauge({
  name: "processing_orders",
  help: "Gauge of processing orders",
  labelNames: ["status"],
});

const ordersCache = new Map<number, orderStatus>();

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
  status: orderStatus,
  orderNumber: number
) => {
  ordersCache.set(orderNumber, status);
  updateCounts();
};
