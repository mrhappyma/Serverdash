// half-baked outlet "framework" from Vacuum. but modified to remove the logger.
// also further modified

import * as Discord from "discord.js";
import type { BitFieldResolvable, GatewayIntentsString } from "discord.js";
import handleError from "./modules/sentry";
import { SupportedLocale, SupportedLocales } from "./i18n";

declare type powercordConfig = {
  intents: BitFieldResolvable<GatewayIntentsString, number>;
};

/**
 * The main class for your bot. Create an instance of this and call `plug()` to start the bot.
 * @param token The bot token to use.
 * @param options Options for the bot.
 * @param options.logLevel The minimum log level to use for the bot. Defaults to `LogLevel.Info`. Logs under this level will not be shown.
 * @param options.intents The bot intents to use.
 */
export default class Powercord {
  private token: string;
  public client: Discord.Client;

  private globalCommands: {
    command: Discord.SlashCommandBuilder | Discord.ContextMenuCommandBuilder;
    callback: (
      interaction: Discord.CommandInteraction,
      locale: SupportedLocale
    ) => void;
    autocomplete?: (interaction: Discord.AutocompleteInteraction) => void;
  }[];
  private buttons: {
    customId: RegExp | string;
    callback: (interaction: Discord.ButtonInteraction) => void;
  }[];
  private stringSelectMenus: {
    customId: RegExp | string;
    callback: (interaction: Discord.StringSelectMenuInteraction) => void;
  }[];
  private userSelectMenus: {
    customId: RegExp | string;
    callback: (interaction: Discord.UserSelectMenuInteraction) => void;
  }[];
  private modals: {
    customId: RegExp | string;
    callback: (interaction: Discord.ModalSubmitInteraction) => void;
  }[];

  constructor(token: string, options: powercordConfig) {
    this.globalCommands = [];
    this.buttons = [];
    this.stringSelectMenus = [];
    this.userSelectMenus = [];
    this.modals = [];

    this.token = token;
    this.client = new Discord.Client({
      intents: options.intents,
    });
  }

  /**
   * Add a global application command to the bot. This will be registered on startup.
   * TODO: Register commands immediately if the bot is already running
   * @param command discord.js command builder object
   * @param callback callback function
   */
  addGlobalCommand(
    command: Discord.SlashCommandBuilder | Discord.ContextMenuCommandBuilder, //TODO: seperate these to make interaction types correct
    callback: (
      interaction: Discord.CommandInteraction,
      locale: SupportedLocale
    ) => void,
    autocomplete?: (interaction: Discord.AutocompleteInteraction) => void
  ) {
    if (this.globalCommands.find((cmd) => cmd.command.name === command.name)) {
      console.log(`Command ${command.name} already registered`);
      return;
    }
    this.globalCommands.push({ command, callback, autocomplete });
  }

  registerButton(
    customId: RegExp | string,
    callback: (interaction: Discord.ButtonInteraction) => void
  ) {
    if (this.buttons.find((btn) => btn.customId === customId)) {
      console.log(`Button ${customId} already registered`);
      return;
    }
    this.buttons.push({ customId, callback });
  }

  registerStringSelectMenu(
    customId: RegExp | string,
    callback: (interaction: Discord.StringSelectMenuInteraction) => void
  ) {
    if (this.stringSelectMenus.find((select) => select.customId === customId)) {
      console.log(`StringSelectMenu ${customId} already registered`);
      return;
    }
    this.stringSelectMenus.push({ customId, callback });
  }

  registerUserSelectMenu(
    customId: RegExp | string,
    callback: (interaction: Discord.UserSelectMenuInteraction) => void
  ) {
    if (this.userSelectMenus.find((select) => select.customId === customId)) {
      console.log(`UserSelectMenu ${customId} already registered`);
      return;
    }
    this.userSelectMenus.push({ customId, callback });
  }

  registerModal(
    customId: RegExp | string,
    callback: (interaction: Discord.ModalSubmitInteraction) => void
  ) {
    if (this.modals.find((modal) => modal.customId === customId)) {
      console.log(`Modal ${customId} already registered`);
      return;
    }
    this.modals.push({ customId, callback });
  }
  //TODO: register functions (except application command) could extend off a base class or something fancy like that.
  //TODO: customId param needs to be rethought. Maybe a custom filter function? Then figure out priority for it if multiple match.

  async plug() {
    await this.client.login(this.token);
    this.client.shard
      ? console.log(`Shard ${this.client.shard.ids[0]} ready`)
      : console.log(`Bot ready`);

    const rest = new Discord.REST().setToken(this.client.token!);
    try {
      await rest.put(Discord.Routes.applicationCommands(this.client.user!.id), {
        body: this.globalCommands.map((cmd) => cmd.command.toJSON()),
      });
    } catch (e) {
      console.log("failed to register application commands" + e);
    }

    this.client.on("interactionCreate", async (interaction) => {
      const locale = SupportedLocales.includes(interaction.locale)
        ? (interaction.locale as SupportedLocale)
        : Discord.Locale.EnglishUS;
      try {
        switch (interaction.type) {
          case Discord.InteractionType.ApplicationCommand:
            const command = this.globalCommands.find(
              (cmd) => cmd.command.name === interaction.commandName
            );
            if (!command) {
              console.log(`Command not found ${interaction.commandName}`);
              return;
            }
            await command.callback(
              interaction as Discord.CommandInteraction,
              locale
            );
            break;
          case Discord.InteractionType.ApplicationCommandAutocomplete:
            const autocomplete = this.globalCommands.find(
              (cmd) => cmd.command.name === interaction.commandName
            )?.autocomplete;
            if (!autocomplete) {
              console.log(`Autocomplete not found ${interaction.commandName}`);
              return;
            }
            await autocomplete(interaction as Discord.AutocompleteInteraction);
            break;
          case Discord.InteractionType.MessageComponent:
            if (interaction.isButton()) {
              const button = this.buttons.find(
                (btn) =>
                  interaction.customId.match(btn.customId)?.[0] ==
                  interaction.customId
              );
              if (!button) {
                console.log(`Button not found ${interaction.customId}`);
                return;
              }
              await button.callback(interaction as Discord.ButtonInteraction);
              return;
            }
            if (interaction.isStringSelectMenu()) {
              const stringSelectMenu = this.stringSelectMenus.find(
                (btn) =>
                  interaction.customId.match(btn.customId)?.[0] ==
                  interaction.customId
              );
              if (!stringSelectMenu) {
                console.log(
                  `StringSelectMenu not found ${interaction.customId}`
                );
                return;
              }
              await stringSelectMenu.callback(
                interaction as Discord.StringSelectMenuInteraction
              );
              return;
            }
            if (interaction.isUserSelectMenu()) {
              const userSelectMenu = this.userSelectMenus.find(
                (btn) =>
                  interaction.customId.match(btn.customId)?.[0] ==
                  interaction.customId
              );
              if (!userSelectMenu) {
                console.log(`UserSelectMenu not found ${interaction.customId}`);
                return;
              }
              await userSelectMenu.callback(
                interaction as Discord.UserSelectMenuInteraction
              );
              return;
            }
            break;
          case Discord.InteractionType.ModalSubmit:
            const modal = this.modals.find(
              (btn) =>
                interaction.customId.match(btn.customId)?.[0] ==
                interaction.customId
            );
            if (!modal) {
              console.log(`Modal not found ${interaction.customId}`);
              return;
            }
            await modal.callback(interaction as Discord.ModalSubmitInteraction);
            break;
        }
      } catch (e) {
        handleError(e, { interaction });
      }
    });
  }
}
