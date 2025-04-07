import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import bot from "..";
import { orderStatus } from "@prisma/client";
import { fileUrl } from "../utils/fillOrderMessage";
import { getOrder } from "../orders/cache";
import L, { eng, localizationMap } from "../i18n";

bot.addGlobalCommand(
  new SlashCommandBuilder()
    .setName(L[eng].LOOKUP_COMMAND.COMMAND_NAME())
    .setNameLocalizations(localizationMap("LOOKUP_COMMAND.COMMAND_NAME"))
    .setDescription(L[eng].LOOKUP_COMMAND.COMMAND_DESCRIPTION())
    .setDescriptionLocalizations(
      localizationMap("LOOKUP_COMMAND.COMMAND_DESCRIPTION")
    )
    .setDMPermission(true)
    .addNumberOption((option) =>
      option
        .setName(L[eng].LOOKUP_COMMAND.ORDER_ID_OPTION_NAME())
        .setNameLocalizations(
          localizationMap("LOOKUP_COMMAND.ORDER_ID_OPTION_NAME")
        )
        .setDescription(L[eng].LOOKUP_COMMAND.ORDER_ID_OPTION_DESCRIPTION())
        .setDescriptionLocalizations(
          localizationMap("LOOKUP_COMMAND.ORDER_ID_OPTION_DESCRIPTION")
        )
        .setRequired(true)
    ) as SlashCommandBuilder,
  async (interaction, locale) => {
    const order = await getOrder(
      interaction.options.get("order", true).value as number
    );

    if (!order) {
      return await interaction.reply({
        content: L[locale].LOOKUP_COMMAND.ORDER_NOT_FOUND_ERROR(),
        ephemeral: true,
      });
    }

    const customer = await bot.client.users.fetch(order.customerId);

    const embed = new EmbedBuilder()
      .setTitle(L[locale].LOOKUP_COMMAND.RESULT_TITLE({ id: order.id }))
      .setDescription(order.order)
      .setAuthor({
        name: order.customerUsername,
        iconURL: customer.avatarURL({}) || customer.defaultAvatarURL,
      })
      .setFields([
        {
          name: L[locale].LOOKUP_COMMAND.CREATED_LABEL(),
          value: `<t:${Math.round(order.createdAt.getTime() / 1000)}:f>`,
          inline: true,
        },
        {
          name: L[locale].LOOKUP_COMMAND.UPDATED_LABEL(),
          value: `<t:${Math.round(order.updatedAt.getTime() / 1000)}:f>`,
          inline: true,
        },
        { name: L[locale].LOOKUP_COMMAND.STATUS_LABEL(), value: order.status },
      ]);

    if (order.chefUsername)
      embed.addFields({
        name: L[locale].LOOKUP_COMMAND.CHEF_LABEL(),
        value: order.chefUsername,
        inline: true,
      });
    if (order.deliveryUsername)
      embed.addFields({
        name: L[locale].LOOKUP_COMMAND.DELIVERY_LABEL(),
        value: order.deliveryUsername,
        inline: true,
      });
    if (order.rejectedReason && order.status == orderStatus.REJECTED)
      embed.addFields({
        name: L[locale].LOOKUP_COMMAND.REJECTED_REASON_LABEL(),
        value: order.rejectedReason,
      });
    if (order.fileUrl && order.status == orderStatus.DELIVERED) {
      embed.addFields({
        name: L[locale].LOOKUP_COMMAND.FILE_LABEL(),
        value: fileUrl(order.fileUrl),
      });
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
