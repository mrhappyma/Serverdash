import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";
import bot, { messagesClient } from "..";
import env from "../utils/env";

messagesClient.registerButton("devtools:role-select", async (interaction) => {
  interaction.deferUpdate();
  const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents([
    new ButtonBuilder()
      .setCustomId("role-select")
      .setLabel("Select roles")
      .setStyle(ButtonStyle.Primary),
  ]);
  const channel = await bot.client.channels.fetch(interaction.channelId);
  if (channel?.isSendable())
    channel!.send({
      content: "Select ping roles to be notified of new orders",
      components: [actionRow],
    });
});

bot.registerButton("role-select", async (interaction) => {
  const kitchen = await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID);
  const member = await kitchen.members.fetch(interaction.user.id);
  const actionRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents([
      new StringSelectMenuBuilder()
        .setCustomId("role-select:select")
        .setMaxValues(2)
        .setMinValues(0)
        .addOptions([
          {
            label: "New orders",
            value: "new-orders",
            description: "Pings for incoming orders",
            default: member.roles.cache.has(env.ORDER_PING_ROLE_ID),
          },
          {
            label: "Delivering orders",
            value: "delivering-orders",
            description: "Pings for orders that need delivered",
            default: member.roles.cache.has(env.DELIVERY_PING_ROLE_ID),
          },
        ]),
    ]);
  interaction.reply({
    components: [actionRow],
    flags: [MessageFlags.Ephemeral],
  });
});

bot.registerStringSelectMenu("role-select:select", async (interaction) => {
  const kitchen = await bot.client.guilds.fetch(env.KITCHEN_SERVER_ID);
  const member = await kitchen.members.fetch(interaction.user.id);
  //for each role add role if selected and not there, remove if not selected and there
  if (interaction.values.includes("new-orders")) {
    if (!member.roles.cache.has(env.ORDER_PING_ROLE_ID)) {
      member.roles.add(env.ORDER_PING_ROLE_ID);
    }
  } else {
    if (member.roles.cache.has(env.ORDER_PING_ROLE_ID)) {
      member.roles.remove(env.ORDER_PING_ROLE_ID);
    }
  }
  if (interaction.values.includes("delivering-orders")) {
    if (!member.roles.cache.has(env.DELIVERY_PING_ROLE_ID)) {
      member.roles.add(env.DELIVERY_PING_ROLE_ID);
    }
  } else {
    if (member.roles.cache.has(env.DELIVERY_PING_ROLE_ID)) {
      member.roles.remove(env.DELIVERY_PING_ROLE_ID);
    }
  }
  interaction.update({
    content: "Roles updated",
    components: [],
  });
});
