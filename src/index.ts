import { PrismaClient, orderStatus } from "@prisma/client";
import Powercord from "./outlet";
import env from "./utils/env";
import { ActivityType } from "discord.js";
import path from "path";
import fs from "fs";
import { finishPackOrder } from "./orders/pack";

export const prisma = new PrismaClient();
const bot = new Powercord(env.DSC_TOKEN, { intents: ["Guilds"] });
export default bot;

bot.client.once("ready", async () => {
  bot.client.user!.setPresence({
    activities: [
      {
        name: "counting down 'till 🦃 day",
        type: ActivityType.Custom,
        state: "become a chef! discord.gg/gN6x8KMtsF",
      },
    ],
  });
  // pack all orders that are currently packing, and got inturrupted by a restart
  const packingOrders = await prisma.order.findMany({
    where: {
      status: orderStatus.PACKING,
    },
  });
  for (const order of packingOrders) finishPackOrder(order.id);
});

const normalizedPath = path.join(__dirname, "modules");
fs.readdirSync(normalizedPath).forEach(function (file: string) {
  import("./modules/" + file);
});

bot.plug();
