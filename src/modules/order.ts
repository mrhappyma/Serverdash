import { GuildChannel, SlashCommandBuilder } from "discord.js";
import bot from "..";
import { closed, closedReason } from "./closed";
import { createOrder, getActiveOrdersForUser } from "../orders/cache";
import { userActiveBans } from "./bans";
import L from "../i18n";

bot.addGlobalCommand(
  new SlashCommandBuilder()
    .setName("order")
    .setDescription("Place an order for delivery")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("order")
        .setDescription(
          "What would you like to order? - 1 reasonable item per order :)"
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
        ephemeral: true,
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
          title: L[locale].ORDER_COMMAND.SENDING_TITLE({
            order: orderText,
          }),
          description: L[locale].ORDER_COMMAND.SENDING_DESCRIPTION(),
          footer: {
            text: L[locale].ORDER_COMMAND.SENDING_FOOTER(),
          },
        },
      ],
      fetchReply: true,
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
      interaction.user.username,
      interaction.channel.id,
      message.id
    );
  }
);
