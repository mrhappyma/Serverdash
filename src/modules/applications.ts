import { z } from "zod";
import bot, { messagesClient, prisma } from "..";
import { KitchenChannel, sendKitchenMessage } from "../utils/kitchenChannels";
import env from "../utils/env";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { applicationStatus, application } from "@prisma/client";
import hasKitchenRole from "../utils/roleCheck";

export const submittedApplicationSchema = z.object({
  why: z.string(),
  source: z.string(),
  token: z.string(),
  pronouns: z.string(),
  tz: z.string(),
});

export const handleIncomingApplication = async (
  data: z.infer<typeof submittedApplicationSchema>
) => {
  const application = await prisma.application.findUnique({
    where: {
      token: data.token,
      status: applicationStatus.DRAFT,
    },
  });
  if (!application) return;
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId(`application:${application.id}:approve`)
      .setLabel("Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`application:${application.id}:reject`)
      .setLabel("Reject")
      .setStyle(ButtonStyle.Danger),
  ]);
  await sendKitchenMessage(KitchenChannel.applications, {
    content: `Application from <@!${application.user}>:\nWhy:\n\`\`\`${data.why}\`\`\`\nSource:\n\`\`\`${data.source}\`\`\`\nUTC Offset: \`${data.tz}\`\npronouns: \`${data.pronouns}\``,
    components: [actionRow],
  });
  await prisma.application.update({
    where: {
      token: data.token,
    },
    data: {
      status: applicationStatus.PENDING,
    },
  });
  const user = await bot.client.users.fetch(application.user);
  await user.send("Got your application! Someone will get back to you soon.");
};

bot.registerButton(
  /application:(\d+):(approve|reject)/,
  async (interaction) => {
    await interaction.deferUpdate();
    const [, applicationId, action] = interaction.customId.split(":");
    const application = await prisma.application.findUnique({
      where: {
        id: parseInt(applicationId),
      },
    });
    if (!application) throw new Error("Application not found");
    const user = await bot.client.users.fetch(application.user);
    if (action == "approve") {
      await user.send(
        "Your chef application has been approved!\nWe stagger new chefs to make sure everything goes smoothly and the kitchen doesn't get overwhelmed. I'll let you know as soon as it's time to start your training! Shouldn't be too long, a few days at most, probably sooner."
      );
      await prisma.application.update({
        where: {
          id: application.id,
        },
        data: {
          status: applicationStatus.APPROVED,
        },
      });
    } else {
      await user.send(
        "Your chef application has been rejected :(\nExpect a DM from a reviewer soon with more info!"
      );
      await prisma.application.update({
        where: {
          id: application.id,
        },
        data: {
          status: applicationStatus.REJECTED,
        },
      });
      await interaction.followUp({
        content: "Don't forget to DM them and say why!",
        ephemeral: true,
      });
    }
    await interaction.update({
      components: [],
    });
  }
);

messagesClient.registerButton("devtools:apply-button", async (interaction) => {
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
  const channel = await bot.client.channels.fetch(interaction.channelId);
  if (channel?.isTextBased())
    await channel.send({ embeds: [embed], components: [actionRow] });
});

bot.registerButton("apply", async (interaction) => {
  await interaction.deferUpdate();

  const isChef = hasKitchenRole("chef", interaction.user.id);
  if (isChef) {
    await interaction.followUp({
      content: "You're already a chef! How are you gonna be a chef twice?",
      ephemeral: true,
    });
    return;
  }

  const training = hasKitchenRole("training", interaction.user.id);
  if (training) {
    await interaction.followUp({
      content: "You're already in training!",
      ephemeral: true,
    });
    return;
  }

  const existingApplications = await prisma.application.findMany({
    where: {
      user: interaction.user.id,
    },
  });

  const awaitingTraining = existingApplications.filter(
    (app) => app.status == applicationStatus.APPROVED
  );
  if (awaitingTraining.length > 0) {
    await interaction.followUp({
      content:
        "Your chef application has been approved!\nWe stagger new chefs to make sure everything goes smoothly and the kitchen doesn't get overwhelmed. I'll let you know as soon as it's time to start your training! Shouldn't be too long.",
      ephemeral: true,
    });
    return;
  }

  const rejectedApplications = existingApplications.filter(
    (app) =>
      app.status == applicationStatus.REJECTED &&
      app.updatedAt.getTime() > Date.now() - 1000 * 60 * 60 * 24 * 14
  );
  if (rejectedApplications.length > 0) {
    const reapplyDate = new Date(
      rejectedApplications[
        rejectedApplications.length - 1
      ].updatedAt.getTime() +
        1000 * 60 * 60 * 24 * 14
    );
    await interaction.followUp({
      content: `You've been rejected recently :( you can apply again <t:${Math.round(
        reapplyDate.getTime() / 1000
      ).toString()}:R>`,
      ephemeral: true,
    });
    return;
  }

  const pendingApplications = existingApplications.filter(
    (app) => app.status == applicationStatus.PENDING
  );
  if (pendingApplications.length > 0) {
    await interaction.followUp({
      content:
        "You already have an application pending! We'll get back to you soon!",
      ephemeral: true,
    });
    return;
  }

  let application: application;
  const draftApplications = existingApplications.filter(
    (app) => app.status == applicationStatus.DRAFT
  );
  if (draftApplications.length > 0) {
    application = draftApplications[0];
  } else {
    application = await prisma.application.create({
      data: {
        user: interaction.user.id,
        token: Math.random().toString(36).substring(2),
        status: applicationStatus.DRAFT,
      },
    });
  }

  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setURL(`${env.APPLICATION_URL}?t=${application.token}`)
      .setLabel("Apply")
      .setStyle(ButtonStyle.Link),
  ]);
  await interaction.followUp({
    content: "Click that button to apply!",
    components: [actionRow],
    ephemeral: true,
  });
});
