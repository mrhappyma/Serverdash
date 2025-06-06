import { order } from "@prisma/client";
import * as Sentry from "@sentry/node";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Interaction,
  Locale,
  Message,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot, { messagesClient } from "..";
import env from "../utils/env";
import L, {
  eng,
  localizationMap,
  SupportedLocale,
  SupportedLocales,
} from "../i18n";

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
  },
  locale: SupportedLocale = Locale.EnglishUS
) => {
  let capture: string | undefined;
  if (usingSentry) {
    capture = Sentry.captureException(e, { extra: c });
  } else {
    console.error(e);
  }

  let content: string = c.order
    ? L[locale].SENTRY_CAPTURE.EXCEPTION_TITLE_WITH_ORDER({ id: c.order.id })
    : L[locale].SENTRY_CAPTURE.EXCEPTION_TITLE();
  content += "\n";
  content += L[locale].SENTRY_CAPTURE.EXCEPTION_DESCRIPTION({
    code: capture || "unknown",
  });

  const message = {
    content,
    components: capture
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setStyle(ButtonStyle.Primary)
              .setCustomId(`error-feedback:${capture}`)
              .setLabel(L[locale].SENTRY_CAPTURE.EXCEPTION_FEEDBACK_LABEL())
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
  bot.registerButton(/^error-feedback:(.*)/, async (interaction, locale) => {
    interaction.showModal(
      new ModalBuilder()
        .setTitle(L[locale].SENTRY_CAPTURE.EXCEPTION_FEEDBACK_TITLE())
        .setCustomId(
          `user-feedback-submit:${interaction.customId.split(":")[1]}`
        )
        .addComponents([
          new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
              .setStyle(TextInputStyle.Paragraph)
              .setCustomId("comments")
              .setLabel(
                L[locale].SENTRY_CAPTURE.EXCEPTION_FEEDBACK_COMMENTS_LABEL()
              )
              .setRequired(true)
          ),
          new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
            new TextInputBuilder()
              .setStyle(TextInputStyle.Short)
              .setCustomId("email")
              .setLabel(L[locale].SENTRY_CAPTURE.FEEDBACK_EMAIL_LABEL())
              .setPlaceholder(
                L[locale].SENTRY_CAPTURE.FEEDBACK_EMAIL_PLACEHOLDER()
              )
              .setRequired(false)
          ),
        ])
    );
  });

  bot.addGlobalCommand(
    new SlashCommandBuilder()
      .setName(L[eng].SENTRY_CAPTURE.FEEDBACK_COMMAND_NAME())
      .setNameLocalizations(
        localizationMap("SENTRY_CAPTURE.FEEDBACK_COMMAND_NAME")
      )
      .setDescription(L[eng].SENTRY_CAPTURE.FEEDBACK_COMMAND_DESCRIPTION())
      .setDescriptionLocalizations(
        localizationMap("SENTRY_CAPTURE.FEEDBACK_COMMAND_DESCRIPTION")
      ),
    async (interaction, locale) => {
      const event = Sentry.captureMessage("feedback", "info");
      interaction.showModal(
        new ModalBuilder()
          .setTitle(L[locale].SENTRY_CAPTURE.GENERAL_FEEDBACK_TITLE())
          .setCustomId(`user-feedback-submit:${event}`)
          .addComponents([
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setStyle(TextInputStyle.Paragraph)
                .setCustomId("comments")
                .setLabel(
                  L[locale].SENTRY_CAPTURE.GENERAL_FEEDBACK_COMMENTS_LABEL()
                )
                .setPlaceholder(
                  L[
                    locale
                  ].SENTRY_CAPTURE.GENERAL_FEEDBACK_COMMENTS_PLACEHOLDER()
                )
                .setRequired(true)
            ),
            new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
              new TextInputBuilder()
                .setStyle(TextInputStyle.Short)
                .setCustomId("email")
                .setLabel(L[locale].SENTRY_CAPTURE.FEEDBACK_EMAIL_LABEL())
                .setPlaceholder(
                  L[locale].SENTRY_CAPTURE.FEEDBACK_EMAIL_PLACEHOLDER()
                )
                .setRequired(false)
            ),
          ])
      );
    }
  );

  bot.registerModal(
    /^user-feedback-submit:(.*)/,
    async (interaction, locale) => {
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
        const feedback = await fetch(
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
        if (!feedback.ok) throw new Error("Failed to send feedback");
      } catch {
        return interaction.reply({
          content: L[locale].SENTRY_CAPTURE.FEEDBACK_ERROR(),
          ephemeral: true,
        });
      }
      interaction.reply({
        content: L[locale].SENTRY_CAPTURE.FEEDBACK_SUCCESS(),
        ephemeral: true,
      });
    }
  );

  messagesClient.registerButton("devtools:error-test", () => {
    throw new Error("fire drill");
  });
};
