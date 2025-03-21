import { GuildChannel, SlashCommandBuilder } from "discord.js";
import bot from "..";
import { closed, closedReason } from "./closed";

import { createOrder, getActiveOrdersForUser } from "../orders/cache";
import { userActiveBans } from "./bans";

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
  async (interaction) => {
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
            title: "Kitchen closed",
            description: closedReason,
          },
        ],
      });
    }

    if (interaction.channel.isThread())
      return interaction.reply({
        content:
          "Due to Discord limitations, you can't order in a thread. Sorry!",
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
        content:
          "I don't have permission to create invites! How do you expect your order to be delivered without that?",
      });
    if (
      !permissions.has("ReadMessageHistory") ||
      !permissions.has("ViewChannel")
    )
      return interaction.reply({
        content:
          "I don't have permission to read message history! I need this to update you on your order.",
      });

    const message = await interaction.reply({
      embeds: [
        {
          title: `Order status - ${orderText}`,
          description: `Sending your order to the kitchen...`,
          footer: {
            text: `This message will be updated as your order is filled`,
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
            title: "You already have an active order!",
            description: "One at a time please!",
          },
        ],
      });

    const bans = userActiveBans(interaction.user.id);
    if (bans.length > 0)
      return interaction.editReply({
        embeds: [
          {
            title: "You are banned from ordering!",
            description: `${
              bans[0].message
            }\n\nYou may appeal your ban starting <t:${Math.floor(
              (bans[0].appealAt?.getTime() ?? 0) / 1000
            )}:R>. Otherwise, it will expire <t:${Math.floor(
              bans[0].endAt.getTime() / 1000
            )}:R>`,
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
