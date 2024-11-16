import { order } from "@prisma/client";
import * as Sentry from "@sentry/node";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Interaction,
  Message,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot from "..";
import env from "../utils/env";

export let usingSentry = false;
if (env.SENTRY_DSN && env.SENTRY_ORG && env.SENTRY_PROJECT && env.SENTRY_TOKEN)
  usingSentry = true;
Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  release: env.SOURCE_COMMIT,
});

const handleError = async (
  e: any,
  c: {
    order?: order;
    interaction?: Interaction;
    message?: Message;
  }
) => {
  let capture: string | undefined;
  if (usingSentry) capture = Sentry.captureException(e, { extra: c });
  const message = {
    content: `Whoa there! Something's set the kitchen ablaze${
      c.order ? ` while we were working on order ${c.order.id}` : ""
    }! ${
      capture
        ? `Don't worry, we've sent a report to the fire department and they'll be on it soon. It would really help if you would hit that button below and tell them more about what happened 👇\n\nIf you end up contacting the kitchen about this, give them the code \`${capture}\`.`
        : ""
    }`,
    components: capture
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setCustomId(`error-feedback:${capture}`)
              .setLabel("add additional details")
          ),
        ]
      : [],
  };
  if (c.interaction && !c.interaction.isAutocomplete()) {
    if (!c.interaction.replied && !c.interaction.deferred) {
      c.interaction.reply({ ...message, ephemeral: true });
    } else {
      c.interaction.followUp(message);
    }
  } else if (c.message) {
    c.message.reply(message);
  } else if (c.order) {
    try {
      const o = c.order;
      await bot.client.shard?.broadcastEval(
        async (c, { o, message }) => {
          const guild = await c.guilds.fetch(o.guildId);
          if (!guild) return;
          const channel = await guild.channels.fetch(o.channelId);
          if (!channel) return;
          if (!channel.isTextBased()) return;
          await channel.send(message);
        },
        { context: { o, message } }
      );
    } catch {}
  }
};
export default handleError;

export const registerSentryButtons = async () => {
  bot.registerButton(/^error-feedback:(.*)/, async (interaction) => {
    interaction.showModal(
      new ModalBuilder()
        .setTitle("Error Feedback")
        .setCustomId(
          `user-feedback-submit:${interaction.customId.split(":")[1]}`
        )
        .addComponents([
          new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
              .setStyle(TextInputStyle.Paragraph)
              .setCustomId("comments")
              .setLabel("What was happening?")
              .setRequired(true)
          ),
          new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
              .setStyle(TextInputStyle.Short)
              .setCustomId("email")
              .setLabel("email (optional)")
              .setPlaceholder("just in case a DM doesn't work")
              .setRequired(false)
          ),
        ])
    );
  });

  bot.addGlobalCommand(
    new SlashCommandBuilder()
      .setName("feedback")
      .setDescription("Something awry? Got a suggestion? Let us know!"),
    async (interaction) => {
      const event = Sentry.captureMessage("feedback", "info");
      interaction.showModal(
        new ModalBuilder()
          .setTitle("Feedback")
          .setCustomId(`user-feedback-submit:${event}`)
          .addComponents([
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setStyle(TextInputStyle.Paragraph)
                .setCustomId("comments")
                .setLabel("What's your feedback?")
                .setPlaceholder("How can we improve?")
                .setRequired(true)
            ),
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setStyle(TextInputStyle.Short)
                .setCustomId("email")
                .setLabel("email (optional)")
                .setPlaceholder(
                  "just in case a DM doesn't work. will never be shared or sold."
                )
                .setRequired(false)
            ),
          ])
      );
    }
  );

  bot.registerModal(/^user-feedback-submit:(.*)/, async (interaction) => {
    if (!usingSentry)
      return interaction.reply({
        content:
          "Sentry is not configured. Please contact the kitchen directly.",
        ephemeral: true,
      });
    const capture = interaction.customId.split(":")[1];
    const comments = interaction.fields.getTextInputValue("comments");
    const email = interaction.fields.getTextInputValue("email");
    try {
      var feedback = await fetch(
        `https://sentry.io/api/0/projects/${env.SENTRY_ORG}/${env.SENTRY_PROJECT}/user-feedback/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.SENTRY_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event_id: capture,
            name: interaction.user.id,
            comments,
            email: email || "serverdash@userexe.me",
          }),
        }
      );
    } catch {
      return interaction.reply({
        content: "Failed to send feedback, sorry about that.",
        ephemeral: true,
      });
    }
    if (!feedback.ok) {
      return interaction.reply({
        content:
          "Failed to send feedback, sorry about that. This is usually due to an invalid email, or waiting a while before submitting feedback.",
        ephemeral: true,
      });
    }
    interaction.reply({
      content: "Got it! Thanks!",
      ephemeral: true,
    });
  });

  bot.registerButton("devtools:error-test", () => {
    throw new Error("fire drill");
  });
};
