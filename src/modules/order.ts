import {
  GuildChannel,
  Locale,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import bot from "..";
import { closed, closedReason } from "./closed";
import { createOrder, getActiveOrdersForUser } from "../orders/cache";
import { userActiveBans } from "./bans";
import L, { eng, localizationMap } from "../i18n";

bot.addGlobalCommand(
  new SlashCommandBuilder()
    .setName(L[eng].ORDER_COMMAND.COMMAND_NAME())
    .setNameLocalizations(localizationMap("ORDER_COMMAND.COMMAND_NAME"))
    .setDescription(L[eng].ORDER_COMMAND.COMMAND_DESCRIPTION())
    .setDescriptionLocalizations(
      localizationMap("ORDER_COMMAND.COMMAND_DESCRIPTION")
    )
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName(L[eng].ORDER_COMMAND.ORDER_OPTION_NAME())
        .setNameLocalizations(
          localizationMap("ORDER_COMMAND.ORDER_OPTION_NAME")
        )
        .setDescription(L[eng].ORDER_COMMAND.ORDER_OPTION_DESCRIPTION())
        .setDescriptionLocalizations(
          localizationMap("ORDER_COMMAND.ORDER_OPTION_DESCRIPTION")
        )
        .setRequired(true)
        .setMaxLength(241)
    ) as SlashCommandBuilder,
  async (interaction, locale) => {
    if (
      !interaction.isChatInputCommand() ||
      !interaction.guild ||
      !interaction.channel
    )
      return;

    if (closed) {
      return interaction.reply({
        embeds: [
          {
            title: L[locale].KITCHEN_CLOSED.TITLE(),
            description: closedReason,
          },
        ],
      });
    }

    if (interaction.channel.isThread())
      return interaction.reply({
        content: L[locale].ORDER_COMMAND.ORDER_IN_THREAD_ERROR(),
      });

    const orderText = interaction.options.getString("order", true);
    const channel = interaction.channel as GuildChannel;
    const permissions = channel.permissionsFor(interaction.client.user);
    if (!permissions)
      return interaction.reply({
        content: "Failed to fetch channel permissions",
        flags: [MessageFlags.Ephemeral],
      });
    if (!permissions.has("CreateInstantInvite"))
      return interaction.reply({
        content: L[locale].ORDER_COMMAND.ORDER_INVITE_PERMISSIONS_ERROR(),
      });
    if (
      !permissions.has("ReadMessageHistory") ||
      !permissions.has("ViewChannel")
    )
      return interaction.reply({
        content: L[locale].ORDER_COMMAND.ORDER_CHANNEL_PERMISSIONS_ERROR(),
      });

    const message = await interaction.reply({
      embeds: [
        {
          title: L[locale].CUSTOMER_STATUS_MESSAGE.TITLE({
            order: orderText,
          }),
          description: L[locale].ORDER_COMMAND.SENDING_DESCRIPTION(),
          footer: {
            text: L[locale].ORDER_COMMAND.SENDING_FOOTER(),
          },
        },
      ],
      withResponse: true,
    });

    const activeOrders = getActiveOrdersForUser(interaction.user.id);
    const activeOrdersFiltered = activeOrders.filter(
      (order) => order.guildId == interaction.guildId
    );
    if (activeOrdersFiltered.length > 0)
      return interaction.editReply({
        embeds: [
          {
            title: L[locale].ORDER_COMMAND.EXISTING_ORDER_ERROR_TITLE(),
            description:
              L[locale].ORDER_COMMAND.EXISTING_ORDER_ERROR_DESCRIPTION(),
          },
        ],
      });

    const bans = userActiveBans(interaction.user.id);
    if (bans.length > 0)
      return interaction.editReply({
        embeds: [
          {
            title: L[locale].ORDER_COMMAND.BANNED_ERROR_TITLE(),
            description: L[locale].ORDER_COMMAND.BANNED_ERROR_DESCRIPTION({
              message: bans[0].message,
              appealTimestamp: `<t:${Math.floor(
                (bans[0].appealAt?.getTime() ?? 0) / 1000
              )}:R>`,
              expireTimestamp: `<t:${Math.floor(
                bans[0].endAt.getTime() / 1000
              )}:R>`,
            }),
          },
        ],
      });

    await createOrder(
      orderText,
      interaction.guild.id,
      interaction.guild.name,
      interaction.user.id,
      interaction.user.globalName ?? interaction.user.username,
      interaction.channel.id,
      message.resource!.message!.id,
      locale
    );
  }
);
