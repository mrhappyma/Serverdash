import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ThreadChannel,
} from "discord.js";
import { messagesClient, prisma } from "..";
import env from "../utils/env";
import { orderStatus } from "@prisma/client";
import emoji, { emojiInline } from "../utils/emoji";
import updateOrderStatusMessage from "../utils/updateOrderStatusMessage";
import {
  KitchenChannel,
  clearKitchenMessages,
  sendKitchenMessage,
} from "../utils/kitchenChannels";
import s3 from "./s3";
import handleError from "./sentry";
import Sqids from "sqids";
import { updateProcessingOrders } from "./metrics";

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
    if (message.channel.parentId != env.NEW_ORDERS_CHANNEL_ID) return;
    if (message.author.id == messagesClient.client.user?.id) return;
    if (message.content.startsWith("//")) return;

    const messageUrls = message.content.match(URL_REGEX);
    const attachments = Array.from(message.attachments.values());
    if ((!messageUrls || !messageUrls[0]) && !attachments[0]) return;
    const orders = await prisma.order.findMany({
      where: {
        relatedKitchenMessages: {
          has: `${KitchenChannel.orders}:${message.channelId}`,
        },
      },
    });
    const order = orders[0];
    if (!order) return;

    if (
      order.chefId !== message.author.id &&
      !env.DEVELOPERS.split(" ").includes(message.author.id)
    ) {
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
      await prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          status: orderStatus.PACKING,
          fileUrl: c,
        },
      });
      updateProcessingOrders(orderStatus.PACKING, order.id);
      setTimeout(() => finishPackOrder(order.id), 1000 * 60 * 5);

      clearKitchenMessages(order.id);
      const timestampIn5Minutes = new Date(Date.now() + 5 * 60 * 1000);
      if (order.statusMessageId)
        updateOrderStatusMessage(
          order.guildId,
          order.channelId,
          order.statusMessageId,
          `Your order is being packed! It will be done <t:${Math.round(
            timestampIn5Minutes.getTime() / 1000
          ).toString()}:R>`
        );
      await sendKitchenMessage(KitchenChannel.logs, {
        content: `${emojiInline.materialLunchDining} <@!${message.author.id}> finished packing order **#${order.id}**`,
        allowedMentions: { parse: [] },
      });

      const channel = message.channel as ThreadChannel;
      await message.reply({
        content: "Got it! Thanks!",
        allowedMentions: { repliedUser: false },
      });
      await channel.setLocked(true, "Order filled!");
    };

    if (ALLOWED_EXTERNAL_SITES.some((site) => sourceURL.startsWith(site))) {
      await finish(sourceURL);
      return;
    } else {
      const sqids = new Sqids();
      const id = sqids.encode([order.id, Date.now()]);

      const s3Key = `orders/${order.id}/${id}.${
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

export const finishPackOrder = async (orderId: number) => {
  try {
    var order = await prisma.order.update({
      where: {
        id: orderId,
      },
      data: {
        status: orderStatus.PACKED,
      },
    });
    updateProcessingOrders(orderStatus.PACKED, order.id);
  } catch (e) {
    sendKitchenMessage(KitchenChannel.logs, {
      content: `:x: Failed to finish packing order ${orderId}!! <@!${
        env.DEVELOPERS.split(" ")[0]
      }> go fix`,
    });
    return { success: false, message: "Failed to finish packing order" };
  }

  const deliveryActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    [
      new ButtonBuilder()
        .setCustomId(`order:${order.id}:deliver`)
        .setLabel("Deliver Order")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("Reject Order")
        .setStyle(ButtonStyle.Danger)
        .setCustomId(`order:${order.id}:reject`),
    ]
  );
  const deliveryEmbed = new EmbedBuilder()
    .setTitle(`Order from **${order.customerUsername}**`)
    .setDescription(order.order)
    .setFooter({ text: `Order ID: ${order.id}` });
  await sendKitchenMessage(
    KitchenChannel.readyOrders,
    {
      embeds: [deliveryEmbed],
      components: [deliveryActionRow],
      content: `<@&${env.DELIVERY_PING_ROLE_ID}>`,
    },
    order.id
  );
  if (order.statusMessageId)
    updateOrderStatusMessage(
      order.guildId,
      order.channelId,
      order.statusMessageId,
      `Your order is ready for delivery!`
    );
  return true;
};
