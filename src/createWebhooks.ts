import { Client } from "discord.js";
import { z } from "zod";

const limitedEnvSchema = z.object({
  DSC_TOKEN: z.string(),
  KITCHEN_SERVER_ID: z.string(),
  NEW_ORDERS_CHANNEL_ID: z.string(),
  READY_ORDERS_CHANNEL_ID: z.string(),
  DELIVERING_ORDERS_CHANNEL_ID: z.string(),
  DELIVERED_ORDERS_CHANNEL_ID: z.string(),
  CANCELLED_ORDERS_CHANNEL_ID: z.string(),
  LOGS_CHANNEL_ID: z.string(),
  CHEF_CHAT_CHANNEL_ID: z.string(),
  APPLICATIONS_CHANNEL_ID: z.string(),
});
const env = limitedEnvSchema.parse(process.env);

const client = new Client({
  intents: [],
});
client.on("ready", async () => {
  console.log("Starting...");
  const guild = await client.guilds.fetch(env.KITCHEN_SERVER_ID);
  if (!guild) {
    console.log("Failed to find guild");
    return;
  }
  console.log("Found guild");
  for (const [k, v] of Object.entries(env)) {
    if (k === "DSC_TOKEN" || k === "KITCHEN_SERVER_ID") continue;
    const channel = await guild.channels.fetch(v);
    if (!channel || !channel.isTextBased() || channel.isThread()) {
      console.log(`Failed to find channel ${v}`);
      return;
    }
    const webhook = await channel.createWebhook({
      name: "Serverdash",
      reason: k.split("_CHANNEL_ID")[0],
    });
    console.log(`${k.split("_CHANNEL_ID")[0]}_WEBHOOK=${webhook.url}`);
  }
  process.exit(0);
});

client.login(env.DSC_TOKEN);
