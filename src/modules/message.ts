import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot, { prisma } from "..";
import fillOrderMessage from "../utils/fillOrderMessage";
import { orderStatus } from "@prisma/client";

bot.registerButton("devtools:message-set", async (interaction) => {
  interaction.deferUpdate();
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId("message-set")
      .setLabel("Set your delivery message")
      .setStyle(ButtonStyle.Primary),
  ]);
  interaction.channel!.send({
    content:
      "Set your prefilled delivery message! The following variables will automatically be filled in. `$mention` and `$item` are required.\n`$mention`-mention the customer\n`$item`-the image url\n`$number`-the order number\n`$chef`-the chef's username\n`$order`-the order\n`$server`-the customer server's name",
    components: [actionRow],
  });
});

bot.registerButton("message-set", async (interaction) => {
  const exists = await prisma.chef.findUnique({
    where: { id: interaction.user.id },
  });
  const modal = new ModalBuilder()
    .setTitle("Set your delivery message")
    .setCustomId("message-set:modal")
    .addComponents([
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId("message")
          .setLabel("Message")
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph)
          .setValue(exists?.message || "")
          .setMaxLength(1000),
      ]),
    ]);
  return interaction.showModal(modal);
});

bot.registerModal("message-set:modal", async (interaction) => {
  const message = interaction.fields.getTextInputValue("message");
  if (!message.includes("$mention") || !message.includes("$item"))
    return interaction.reply({
      content: "Your message must contain `$mention` and `$item`",
      ephemeral: true,
    });
  await prisma.chef.upsert({
    where: { id: interaction.user.id },
    update: { message },
    create: { id: interaction.user.id, message },
  });
  return interaction.reply({
    content: `Your message has been set!\n\n${fillOrderMessage(
      {
        id: 0,
        status: orderStatus.DELIVERING,
        order: "a big bowl of spaghetti",
        guildId: "0",
        guildName: "the nuclear collective",
        customerId: "643945264868098049",
        customerUsername: "mr. joesph r biden jr.",
        channelId: "2",
        statusMessageId: "3",
        chefId: "4",
        chefUsername: "chefy mcchef face",
        deliveryId: interaction.user.id,
        deliveryUsername: interaction.user.username,
        fileUrl: "s3 m/brazil.jpg",
        rejectedReason: null,
        rejectorId: null,
        relatedKitchenMessages: [],
        invite: "discord.gg/deez-nuts",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      message
    )}`,
    ephemeral: true,
  });
});
