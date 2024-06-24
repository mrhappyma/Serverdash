import { OrderStatus } from "aws-sdk/clients/outposts";
import { Gauge, Histogram, collectDefaultMetrics } from "prom-client";
import { prisma } from "..";
import { orderStatus } from "@prisma/client";

collectDefaultMetrics();

const processingOrders = new Gauge({
  name: "processing_orders",
  help: "Gauge of processing orders",
  labelNames: ["status"],
});
const ordersCache = new Map<number, OrderStatus>();
const initOrdersCache = async () => {
  const orders = await prisma.order.findMany({
    where: {
      status: {
        notIn: [
          orderStatus.DELIVERED,
          orderStatus.CANCELLED,
          orderStatus.REJECTED,
        ],
      },
    },
  });
  orders.forEach((order) => {
    ordersCache.set(order.id, order.status);
  });
  updateCounts();
};
initOrdersCache();

const updateCounts = () => {
  for (const status of Object.values(orderStatus)) {
    if (status === orderStatus.DELIVERED) continue;
    if (status === orderStatus.CANCELLED) continue;
    if (status === orderStatus.REJECTED) continue;
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
  if (
    status === orderStatus.DELIVERED ||
    status === orderStatus.CANCELLED ||
    status === orderStatus.REJECTED
  ) {
    ordersCache.delete(orderNumber);
  } else {
    ordersCache.set(orderNumber, status);
  }
  updateCounts();
};
