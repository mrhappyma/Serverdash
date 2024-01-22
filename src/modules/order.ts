import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  GuildChannel,
  SlashCommandBuilder,
} from "discord.js";
import bot, { prisma } from "..";
import { emojiInline } from "../utils/emoji";
import env from "../utils/env";
import { KitchenChannel, sendKitchenMessage } from "../utils/kitchenChannels";
import { closed, closedReason } from "./closed";

bot.addGlobalCommand(
  new SlashCommandBuilder()
    .setName("order")
    .setDescription("Place an order for delivery")
    .setDMPermission(false)
    .addStringOption((option) =>
      option
        .setName("order")
        .setDescription("What would you like to order?")
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
    const message = await interaction.reply({
      content: "Working on it...",
      fetchReply: true,
    });
    try {
      await interaction.channel.messages.edit(message.id, {
        content: "Sending your order to the kitchen...",
      });
    } catch (e) {
      console.log(e);
      console.log(message.id);
      return await interaction.followUp({
        content:
          "Hey! I don't have access to my own messages in here, so I wouldn't be able to update you with your order's status. Please ask an admin to fix this, then re-order :)\n\n(while you're at it, make sure new members can send messages in here too!)",
      });
    }

    const activeOrders = await prisma.order.findMany({
      where: {
        customerId: interaction.user.id,
        guildId: interaction.guild.id,
      },
    });
    const activeOrdersFiltered = activeOrders.filter(
      (order) => order.status !== "DELIVERED" && order.status !== "REJECTED"
    );
    if (activeOrdersFiltered.length > 0)
      return interaction.editReply({
        content: "You already have an active order! One at a time please!",
      });

    const record = await prisma.order.create({
      data: {
        channelId: interaction.channel.id,
        customerId: interaction.user.id,
        customerUsername: interaction.user.username,
        guildId: interaction.guild.id,
        guildName: interaction.guild.name,
        order: orderText,
        statusMessageId: message.id,
      },
    });

    const kitchenActionRow =
      new ActionRowBuilder<ButtonBuilder>().addComponents([
        new ButtonBuilder()
          .setCustomId(`order:${record.id}:fill`)
          .setLabel("Fill Order")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setLabel("Reject Order")
          .setStyle(ButtonStyle.Danger)
          .setCustomId(`order:${record.id}:reject`),
      ]);
    const kitchenEmbed = new EmbedBuilder()
      .setTitle(`Order from **${interaction.user.username}**`)
      .setDescription(orderText)
      .setFooter({ text: `Order ID: ${record.id}` });
    await sendKitchenMessage(
      KitchenChannel.newOrders,
      {
        embeds: [kitchenEmbed],
        components: [kitchenActionRow],
        content: `<@&${env.ORDER_PING_ROLE_ID}>`,
      },
      record.id
    );
    await sendKitchenMessage(KitchenChannel.logs, {
      content: `${emojiInline.materialEdit} <@!${interaction.user.id}> created order **#${record.id}** for **${orderText}**`,
      allowedMentions: { parse: [] },
    });
    await interaction.editReply({
      content: "",
      embeds: [
        {
          title: `Order status - ${orderText}`,
          description: `Order ${record.id} has been sent to the kitchen!`,
          footer: {
            text: `Order ID: ${record.id} | This message will be updated as your order is filled`,
          },
        },
      ],
    });
  }
);
