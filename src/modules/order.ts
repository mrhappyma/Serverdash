import {
  ChatInputCommandInteraction,
  GuildChannel,
  SlashCommandBuilder,
} from "discord.js";
import bot from "..";
import createOrder from "../orders/create";

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
    if (!interaction.isChatInputCommand()) return;
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
    const message = await interaction.deferReply({ fetchReply: true });
    //check if the bot can create invites
    const order = await createOrder(
      orderText,
      interaction.guild!.id,
      interaction.guild!.name,
      interaction.user.id,
      interaction.user.tag,
      interaction.channelId,
      message.id
    );
    await interaction.editReply({
      embeds: [
        {
          title: `Order status - ${orderText}`,
          description: order.message,
          footer: {
            text: `Order ID: ${order.id} | This message will be updated as your order is filled`,
          },
        },
      ],
    });
  }
);
