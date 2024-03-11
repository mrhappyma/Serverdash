import { z } from "zod";
import bot, { prisma } from "..";
import { KitchenChannel, sendKitchenMessage } from "../utils/kitchenChannels";
import env from "../utils/env";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

export const submittedApplicationSchema = z.object({
  why: z.string(),
  source: z.string(),
  token: z.string(),
});

export const handleIncomingApplication = async (
  data: z.infer<typeof submittedApplicationSchema>
) => {
  const application = await prisma.application.findUnique({
    where: {
      token: data.token,
    },
  });
  if (!application || !application.active) return;
  await sendKitchenMessage(KitchenChannel.applications, {
    content: `Application from <@!${application.user}>:\nWhy:\n\`\`\`${data.why}\`\`\`\nSource:\n\`\`\`${data.source}\`\`\``,
  });
  await prisma.application.update({
    where: {
      token: data.token,
    },
    data: {
      active: false,
    },
  });
  const user = await bot.client.users.fetch(application.user);
  await user.send("Got your application! Someone will get back to you soon.");
};

export const createApplication = async (user: string) => {
  const application = await prisma.application.create({
    data: {
      user,
    },
  });
  return `${env.APPLICATION_URL}?t=${application.token}`;
};

bot.registerButton("devtools:apply-button", async (interaction) => {
  await interaction.deferUpdate();
  const embed = new EmbedBuilder()
    .setTitle("Applications")
    .setDescription(
      "Want to help out in the kitchen? We're always looking for new chefs!"
    );
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId("apply")
      .setLabel("Apply")
      .setStyle(ButtonStyle.Primary),
  ]);
  await interaction.channel!.send({ embeds: [embed], components: [actionRow] });
});

bot.registerButton("apply", async (interaction) => {
  await interaction.deferUpdate();
  const application = await createApplication(interaction.user.id);
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setURL(application)
      .setLabel("Apply")
      .setStyle(ButtonStyle.Link),
  ]);
  await interaction.followUp({
    content: "Click that button to apply!",
    components: [actionRow],
    ephemeral: true,
  });
});
