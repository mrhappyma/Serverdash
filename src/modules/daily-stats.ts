import { orderStatus } from "@prisma/client";
import { prisma } from "..";
import agenda from "./jobs";

let dailyStats = {
  ordersDeliveredYesterday: 0,
  topChefYesterday: "",
  topChefOrdersYesterday: 0,
  topDeliveryPersonYesterday: "",
  topDeliveryPersonOrdersYesterday: 0,
};
export default dailyStats;

const updateDailyStats = async () => {
  const startOfYesterday = new Date().setDate(new Date().getDate() - 1);
  const endOfYesterday = startOfYesterday + 24 * 60 * 60 * 1000;
  const orders = await prisma.order.count({
    where: {
      status: orderStatus.DELIVERED,
      updatedAt: {
        gte: new Date(startOfYesterday),
        lt: new Date(endOfYesterday),
      },
    },
  });
  dailyStats.ordersDeliveredYesterday = orders;
  if (orders > 0) {
    const topChef = await prisma.order.groupBy({
      by: ["chefId"],
      _count: {
        chefId: true,
      },
      where: {
        status: orderStatus.DELIVERED,
        updatedAt: {
          gte: new Date(startOfYesterday),
          lt: new Date(endOfYesterday),
        },
      },
      orderBy: {
        _count: {
          chefId: "desc",
        },
      },
      take: 1,
    });
    if (topChef.length > 0) {
      dailyStats.topChefYesterday = topChef[0].chefId!;
      dailyStats.topChefOrdersYesterday = topChef[0]._count.chefId;
    }

    const topDeliveryPerson = await prisma.order.groupBy({
      by: ["deliveryId"],
      _count: {
        deliveryId: true,
      },
      where: {
        status: orderStatus.DELIVERED,
        updatedAt: {
          gte: new Date(startOfYesterday),
          lt: new Date(endOfYesterday),
        },
      },
      orderBy: {
        _count: {
          deliveryId: "desc",
        },
      },
      take: 1,
    });
    if (topDeliveryPerson.length > 0) {
      dailyStats.topDeliveryPersonYesterday = topDeliveryPerson[0].deliveryId!;
      dailyStats.topDeliveryPersonOrdersYesterday =
        topDeliveryPerson[0]._count.deliveryId;
    }
  } else {
    dailyStats.topChefYesterday = "";
    dailyStats.topChefOrdersYesterday = 0;
    dailyStats.topDeliveryPersonYesterday = "";
    dailyStats.topDeliveryPersonOrdersYesterday = 0;
  }
};

updateDailyStats().then(() => {
  agenda.define("updateDailyStats", async () => {
    await updateDailyStats();
  });
  agenda.every("0 0 * * *", "updateDailyStats");
});
