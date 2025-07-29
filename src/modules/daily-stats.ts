import { orderStatus } from "@prisma/client";
import { prisma } from "..";
import agenda from "./jobs";
import { getNickname } from "./nicknames";

let publicDailyStats = {
  ordersDeliveredYesterday: 0 as number | "the kitchen was closed yesterday :(",
  topChefYesterday: "",
  topChefOrdersYesterday: 0,
  topDeliveryPersonYesterday: "",
  topDeliveryPersonOrdersYesterday: 0,
};
let topChefYesterdayId = "";
let topDeliveryPersonYesterdayId = "";
export default publicDailyStats;

const updateDailyStats = async () => {
  const startOfYesterday = new Date();
  startOfYesterday.setHours(0, 0, 0, 0);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = new Date();
  endOfYesterday.setHours(23, 59, 59, 999);
  endOfYesterday.setDate(endOfYesterday.getDate() - 1);

  const kitchenClosingsYesterday = await prisma.kitchenClosed.findMany({
    where: {
      OR: [{ until: null }, { until: { gt: new Date(startOfYesterday) } }],
    },
  });
  const totalClosedTime = kitchenClosingsYesterday.reduce((total, closing) => {
    const until = closing.until ? new Date(closing.until) : new Date();
    return total + (until.getTime() - new Date(closing.from).getTime());
  }, 0);
  const closedHours = totalClosedTime / (1000 * 60 * 60);

  if (closedHours >= 12) {
    publicDailyStats.ordersDeliveredYesterday =
      "the kitchen was closed yesterday :(";
  } else {
    const orders = await prisma.order.count({
      where: {
        status: orderStatus.DELIVERED,
        updatedAt: {
          gte: new Date(startOfYesterday),
          lte: new Date(endOfYesterday),
        },
      },
    });
    publicDailyStats.ordersDeliveredYesterday = orders;
  }

  if (
    typeof publicDailyStats.ordersDeliveredYesterday === "number" &&
    publicDailyStats.ordersDeliveredYesterday > 0
  ) {
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
      topChefYesterdayId = topChef[0].chefId!;
      publicDailyStats.topChefYesterday = await getNickname(topChef[0].chefId!);
      publicDailyStats.topChefOrdersYesterday = topChef[0]._count.chefId;
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
      topDeliveryPersonYesterdayId = topDeliveryPerson[0].deliveryId!;
      publicDailyStats.topDeliveryPersonYesterday = await getNickname(
        topDeliveryPerson[0].deliveryId!
      );
      publicDailyStats.topDeliveryPersonOrdersYesterday =
        topDeliveryPerson[0]._count.deliveryId;
    }
  } else {
    publicDailyStats.topChefYesterday = "";
    publicDailyStats.topChefOrdersYesterday = 0;
    publicDailyStats.topDeliveryPersonYesterday = "";
    publicDailyStats.topDeliveryPersonOrdersYesterday = 0;
  }
};

updateDailyStats().then(() => {
  agenda.define("updateDailyStats", async () => {
    await updateDailyStats();
  });
  agenda.every("0 0 * * *", "updateDailyStats");
});
