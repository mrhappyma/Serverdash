import { ban } from "@prisma/client";
import bot, { prisma } from "..";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import * as chrono from "chrono-node";

const bans: ban[] = [];
//load active bans
const loadActiveBans = async () => {
  const beans = await prisma.ban.findMany({
    where: {
      endAt: { gt: new Date() },
    },
  });
  bans.push(...beans);
  console.log(bans);
};
loadActiveBans();

export const userActiveBans = (userId: string) => {
  return bans.filter((ban) => ban.user === userId && ban.endAt > new Date());
};

const addBan = async (
  userId: string,
  reason: string,
  message: string,
  endAt: Date,
  appealAt?: Date
) => {
  const ban = await prisma.ban.create({
    data: {
      user: userId,
      reason,
      message,
      endAt,
      appealAt,
    },
  });
  bans.push(ban);
};

bot.registerButton("devtools:manage-bans", async (interaction) => {
  const a1 = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents([
    new UserSelectMenuBuilder().setCustomId("devtools:manage-bans:user"),
  ]);
  return await interaction.update({
    components: [a1],
  });
});

bot.registerUserSelectMenu("devtools:manage-bans:user", async (interaction) => {
  const user = interaction.users.first()!;
  const bans = userActiveBans(user.id);
  const embed = new EmbedBuilder()
    .setTitle(`Bans for ${user.tag}`)
    .setDescription(
      bans.length > 0 ? "User is currently banned" : "User is not banned"
    )
    .addFields(
      bans.map((ban) => ({
        name: ban.id.toString(),
        value: `Reason: ${ban.reason}\nMessage: ${
          ban.message
        }\nEnd at: <t:${Math.floor(
          ban.endAt.getTime() / 1000
        )}:R>\nAppeal at: <t:${Math.floor(
          (ban.appealAt?.getTime() ?? 0) / 1000
        )}:R>`,
      }))
    );
  const a1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
    new StringSelectMenuBuilder()
      .setCustomId("devtools:manage-bans:select")
      .setPlaceholder("Select a ban")
      .addOptions(
        bans.map((ban) => ({
          label: `Ban ${ban.id}`,
          value: ban.id.toString(),
        }))
      )
      .setDisabled(bans.length == 0),
  ]);
  if (bans.length == 0)
    a1.components[0].addOptions({
      label: "No bans",
      value: "no-bans",
    });
  const a2 = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`devtools:manage-bans:create:${user.id}`)
      .setLabel("Create ban")
      .setStyle(ButtonStyle.Danger)
      .setEmoji("🔨"),
  ]);
  return await interaction.update({
    embeds: [embed],
    components: [a1, a2],
  });
});

bot.registerButton(/devtools:manage-bans:create:(.+)/, async (interaction) => {
  const userId = interaction.customId.split(":")[3];
  const modal = new ModalBuilder()
    .setTitle("Create ban")
    .setCustomId(`devtools:manage-bans:create:${userId}:modal`)
    .addComponents([
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId("reason")
          .setLabel("reason")
          .setStyle(TextInputStyle.Paragraph),
      ]),
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId("message")
          .setLabel("message")
          .setStyle(TextInputStyle.Paragraph),
      ]),
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId("endAt")
          .setLabel("end at")
          .setStyle(TextInputStyle.Short),
      ]),
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId("appealAt")
          .setLabel("appeal at")
          .setStyle(TextInputStyle.Short)
          .setRequired(false),
      ]),
    ]);
  return await interaction.showModal(modal);
});

bot.registerModal(
  /devtools:manage-bans:create:(.+):modal/,
  async (interaction) => {
    const userId = interaction.customId.split(":")[3];
    const reason = interaction.fields.getTextInputValue("reason");
    const message = interaction.fields.getTextInputValue("message");
    const endAtInput = interaction.fields.getTextInputValue("endAt");
    const appealAtInput = interaction.fields.getTextInputValue("appealAt");

    const endAt = chrono.parseDate(endAtInput);
    const appealAt = chrono.parseDate(appealAtInput);

    if (!endAt || (appealAtInput && !appealAt))
      return interaction.reply({
        content:
          'Invalid date (s).\nIf you\'re trying to specify a relative date start with "in" like "in 2 months".',
        ephemeral: true,
      });

    await addBan(userId, reason, message, endAt, appealAt ?? undefined);
    return await interaction.reply({
      content: "Ban added",
      ephemeral: true,
    });
  }
);
