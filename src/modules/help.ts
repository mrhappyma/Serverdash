import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from "discord.js";
import bot from "..";

bot.addGlobalCommand(
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Learn about & get help with the bot"),
  (interaction) => {
    const embed = new EmbedBuilder()
      .setTitle("Serverdash")
      .setDescription(
        "Order (a picture of) anything (within reason) from your Discord server! Powered by real life humans!\nJoin the kitchen if you want to help fill orders, or if you need any help."
      );
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setLabel("Privacy")
        .setURL("https://dsc.kitchen/privacy")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Open-source on GitHub")
        .setURL("https://dsc.kitchen/git")
        .setStyle(ButtonStyle.Link),
      // new ButtonBuilder()
      //   .setLabel("Roadmap")
      //   .setURL("https://dsc.kitchen/board")
      //   .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Invite to your server")
        .setURL(
          `https://discord.com/api/oauth2/authorize?client_id=${interaction.client.user.id}&permissions=2049&scope=bot%20applications.commands`
        )
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Join Kitchen")
        .setURL("https://discord.gg/erQNNwJEaK")
        .setStyle(ButtonStyle.Link),
    ]);
    interaction.reply({
      embeds: [embed],
      components: [actionRow],
      ephemeral: true,
    });
  }
);
