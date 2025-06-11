import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
} from "discord.js";
import bot from "..";
import L, { eng, localizationMap } from "../i18n";

bot.addGlobalCommand(
  new SlashCommandBuilder()
    .setName(L[eng].HELP_COMMAND.COMMAND_NAME())
    .setNameLocalizations(localizationMap("HELP_COMMAND.COMMAND_NAME"))
    .setDescription("Learn about & get help with the bot")
    .setDescriptionLocalizations(
      localizationMap("HELP_COMMAND.COMMAND_DESCRIPTION")
    ),
  (interaction, locale) => {
    const embed = new EmbedBuilder()
      .setTitle(L[locale].NAME())
      .setDescription(
        L[locale].HELP_COMMAND.BODY({ tagline: L[locale].TAGLINE() })
      );
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setLabel(L[locale].HELP_COMMAND.BUTTON_PRIVACY_LABEL())
        .setURL("https://dsc.kitchen/privacy")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel(L[locale].HELP_COMMAND.BUTTON_GIT_LABEL())
        .setURL("https://dsc.kitchen/git")
        .setStyle(ButtonStyle.Link),
      // new ButtonBuilder()
      //   .setLabel("Roadmap")
      //   .setURL("https://dsc.kitchen/board")
      //   .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel(L[locale].HELP_COMMAND.BUTTON_INVITE_LABEL())
        .setURL(
          `https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=2049&scope=bot%20applications.commands`
        )
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel(L[locale].HELP_COMMAND.BUTTON_KITCHEN_LABEL())
        .setURL("https://discord.gg/erQNNwJEaK")
        .setStyle(ButtonStyle.Link),
    ]);
    interaction.reply({
      embeds: [embed],
      components: [actionRow],
      flags: [MessageFlags.Ephemeral],
    });
  }
);
