import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot, { messagesClient, prisma } from "..";
import { emojiInline } from "../utils/emoji";
import { sendKitchenMessage, KitchenChannel } from "../utils/kitchenChannels";
import hasKitchenRole from "../utils/roleCheck";
import { closed } from "./closed";

messagesClient.addGlobalCommand(
  new SlashCommandBuilder().setName("devtools").setDescription("secret sauce"),
  async (interaction) => {
    if (!interaction.isCommand()) return;
    if (!(await hasKitchenRole("admin", interaction.user.id)))
      return interaction.reply({
        content: "the levee is dry (haha cause the song is pie related)",
        flags: [MessageFlags.Ephemeral],
      });

    const a1 = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId("devtools:role-select")
        .setLabel("Send role select menu")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("devtools:message-set")
        .setLabel("Send message set menu")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("devtools:apply-button")
        .setLabel("Send apply menu")
        .setStyle(ButtonStyle.Secondary),
    ]);
    const a2 = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId("devtools:dm")
        .setLabel("message user")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("devtools:manage-bans")
        .setLabel("manage bans")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("devtools:edit-order")
        .setLabel("edit order")
        .setStyle(ButtonStyle.Secondary),
    ]);
    const a3 = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId("devtools:closed-toggle")
        .setLabel(closed ? "Open kitchen" : "Close kitchen")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("devtools:error-test")
        .setLabel("fire drill")
        .setStyle(ButtonStyle.Secondary),
    ]);
    return interaction.reply({
      components: [a1, a2, a3],
      flags: [MessageFlags.Ephemeral],
    });
  }
);

messagesClient.registerButton("devtools:dm", async (interaction) => {
  const modal = new ModalBuilder()
    .setTitle("Message user")
    .setCustomId("devtools:dm:modal")
    .addComponents([
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId("user")
          .setLabel("User ID")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setMinLength(18)
          .setMaxLength(19),
      ]),
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId("content")
          .setLabel("Message content")
          .setRequired(true)
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(4000),
      ]),
    ]);
  return interaction.showModal(modal);
});

messagesClient.registerModal("devtools:dm:modal", async (interaction) => {
  const user = interaction.fields.getTextInputValue("user");
  const content = interaction.fields.getTextInputValue("content");
  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialMail} <@!${interaction.user.id}> sent a message to <@!${user}>\n\`\`\`${content}\`\`\``,
  });
  await (await bot.client.users.fetch(user)).send(content);
  interaction.reply({
    content: "Message sent",
    flags: [MessageFlags.Ephemeral],
  });
});
