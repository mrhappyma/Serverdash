import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import bot, { prisma } from "..";
import { orderStatus } from "@prisma/client";
import { fileUrl } from "../utils/fillOrderMessage";
import { getOrder } from "../orders/cache";

bot.addGlobalCommand(
  new SlashCommandBuilder()
    .setName("lookup")
    .setDescription("Get information about an order")
    .setDMPermission(true)
    .addNumberOption((option) =>
      option.setName("order").setDescription("The order ID").setRequired(true)
    ) as SlashCommandBuilder,
  async (interaction) => {
    const order = await getOrder(
      interaction.options.get("order", true).value as number
    );

    if (!order) {
      return await interaction.reply({
        content: "Order not found",
        ephemeral: true,
      });
    }

    const customer = await bot.client.users.fetch(order.customerId);

    const embed = new EmbedBuilder()
      .setTitle(`Order #${order.id}`)
      .setDescription(order.order)
      .setAuthor({
        name: order.customerUsername,
        iconURL: customer.avatarURL({}) || customer.defaultAvatarURL,
      })
      .setFields([
        {
          name: "Created",
          value: `<t:${Math.round(order.createdAt.getTime() / 1000)}:f>`,
          inline: true,
        },
        {
          name: "Last Updated",
          value: `<t:${Math.round(order.updatedAt.getTime() / 1000)}:f>`,
          inline: true,
        },
        { name: "Status", value: order.status },
      ]);

    if (order.chefUsername)
      embed.addFields({
        name: "Chef",
        value: order.chefUsername,
        inline: true,
      });
    if (order.deliveryUsername)
      embed.addFields({
        name: "Deliverer",
        value: order.deliveryUsername,
        inline: true,
      });
    if (
      order.fileUrl &&
      (order.status == orderStatus.DELIVERED ||
        order.status == orderStatus.REJECTED)
    ) {
      embed.addFields({ name: "File", value: fileUrl(order.fileUrl) });
      const isImage =
        order.fileUrl?.endsWith(".png") ||
        order.fileUrl?.endsWith(".jpg") ||
        order.fileUrl?.endsWith(".jpeg") ||
        order.fileUrl?.endsWith(".gif") ||
        order.fileUrl?.endsWith(".webp");
      if (isImage) embed.setImage(fileUrl(order.fileUrl));
    }

    return await interaction.reply({ embeds: [embed] });
  }
);
