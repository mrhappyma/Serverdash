import { PrismaClient, orderStatus } from "@prisma/client";
import Powercord from "./outlet";
import env from "./utils/env";
import { ActivityType } from "discord.js";
import path from "path";
import fs from "fs";
import { registerSentryButtons } from "./modules/sentry";

export const prisma = new PrismaClient();
const bot = new Powercord(env.DSC_TOKEN, {
  intents: env.COLLECTOR_TOKEN
    ? ["Guilds"]
    : ["Guilds", "GuildMessages", "MessageContent", "GuildMembers"],
});
export default bot;
export const collector = env.COLLECTOR_TOKEN
  ? new Powercord(env.COLLECTOR_TOKEN, {
      intents: ["GuildMessages", "MessageContent", "GuildMembers"],
    })
  : null;
export const messagesClient = collector ?? bot;
registerSentryButtons();
import "./modules/metrics";

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
});

const normalizedPath = path.join(__dirname, "modules");
fs.readdirSync(normalizedPath).forEach(function (file: string) {
  import("./modules/" + file);
});

bot.plug();
collector?.plug();
