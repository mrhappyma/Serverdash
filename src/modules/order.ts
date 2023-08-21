import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
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
    const message = await interaction.deferReply({ fetchReply: true });
    const order = await createOrder(
      orderText,
      interaction.guildId!,
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
