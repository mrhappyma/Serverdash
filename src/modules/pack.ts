import { ThreadChannel } from "discord.js";
import bot, { messagesClient, prisma } from "..";
import env from "../utils/env";
import { orderStatus } from "@prisma/client";
import emoji from "../utils/emoji";
import { KitchenChannel } from "../utils/kitchenChannels";
import s3 from "./s3";
import handleError from "./sentry";
import Sqids from "sqids";
import updateOrderStatus from "../orders/updateStatus";
import agenda from "./jobs";
import { Job, JobAttributesData } from "agenda";

// this took way too long to get copilot to spit out it had better work
const URL_REGEX =
  /(https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*))/g;
const ALLOWED_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "video/webm",
  "video/mp4",
  "image/webp",
];
const ALLOWED_EXTERNAL_SITES = ["https://youtu.be/", "https://wikihow.com/"];

messagesClient.client.on("messageCreate", async (message) => {
  try {
    if (!message.channel.isThread()) return;
    if (
      message.channel.parentId != env.NEW_ORDERS_CHANNEL_ID &&
      message.channel.parentId != env.TRAINING_NEW_ORDERS_CHANNEL_ID
    )
      return;
    if (message.author.id == messagesClient.client.user?.id) return;
    if (message.content.startsWith("//")) return;

    const messageUrls = message.content.match(URL_REGEX);
    const attachments = Array.from(message.attachments.values());
    if ((!messageUrls || !messageUrls[0]) && !attachments[0]) return;
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          {
            relatedKitchenMessages: {
              has: `${KitchenChannel.training_orders}:${message.channelId}`,
            },
          },
          {
            relatedKitchenMessages: {
              has: `${KitchenChannel.orders}:${message.channelId}`,
            },
          },
        ],
      },
    });
    const order = orders[0];
    if (!order) return;

    if (order.chefId !== message.author.id) {
      await message.reply({
        content: "Hey, this is someone else's order! Go get your own!",
        allowedMentions: { repliedUser: false },
      });
      return;
    }

    await message.react(emoji.materialSync);

    const sourceURL = attachments[0]?.url ?? messageUrls![0];

    const submitError = async (m: string) => {
      await message.react(emoji.materialError);
      //TODO: remove interactions
      return await message.reply({
        content: m,
        allowedMentions: { repliedUser: false },
      });
    };

    try {
      var request = await fetch(sourceURL);
    } catch {
      await submitError("Failed to fetch :(");
      return;
    }
    if (!request.ok) {
      await submitError("Failed to fetch :(");
      return;
    }

    if (
      !ALLOWED_CONTENT_TYPES.includes(
        request.headers.get("content-type") ?? ""
      ) &&
      !ALLOWED_EXTERNAL_SITES.some((site) => sourceURL.startsWith(site))
    ) {
      await submitError("Invalid file type");
      return;
    }

    const finish = async (c: string) => {
      await message.react(emoji.materialDone);

      await updateOrderStatus({
        id: order.id,
        status: orderStatus.PACKING,
        chef: message.author.id,
        chefUsername: message.author.username,
        fileUrl: c,
      });

      const words = [
        "om",
        "nom",
        "scrumptious",
        "yummy",
        "delicious",
        "scarf",
        "scrunch",
        "chomp",
        "slurp",
      ];
      const sentenceLength = Math.floor(Math.random() * 10) + 1;
      const sentence = Array.from(
        { length: sentenceLength },
        () => words[Math.floor(Math.random() * words.length)]
      ).join(" ");

      const channel = message.channel as ThreadChannel;
      await message.reply({
        content: `${sentence} (thank you!)`,
        allowedMentions: { repliedUser: false },
      });
      await channel.members.remove(message.author.id);
      await channel.setLocked(true, "Order filled!");
    };

    if (ALLOWED_EXTERNAL_SITES.some((site) => sourceURL.startsWith(site))) {
      await finish(sourceURL);
      return;
    } else {
      const sqids = new Sqids();
      const id = sqids.encode([order.id, Date.now()]).slice(0, 5);

      const s3Key = `o/${id}.${
        request.headers.get("content-type")?.split("/")[1].split(";")[0]
      }`;

      const buffer = Buffer.from(await request.arrayBuffer());

      s3.upload(
        {
          Bucket: env.S3_BUCKET,
          Key: s3Key,
          Body: buffer,
        },
        async (err, data) => {
          if (err) {
            submitError(`Failed to upload!\n\`\`\`${err}\`\`\``);
            return;
          }
          await finish(`s3 ${data.Key}`);
        }
      );
    }
  } catch (e) {
    handleError(e, { message });
  }
});

export interface PackOrderJob extends JobAttributesData {
  orderId: number;
}
agenda.define<PackOrderJob>(
  "finish packing order",
  async (job: Job<PackOrderJob>) => {
    const update = await updateOrderStatus({
      id: job.attrs.data.orderId,
      status: orderStatus.PACKED,
      chef: bot.client.user!.id,
      chefUsername: bot.client.user!.username,
    });

    return update.success;
  }
);
