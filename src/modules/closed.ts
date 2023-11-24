import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import bot, { prisma } from "..";
import { KitchenChannel, sendKitchenMessage } from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";

export let closed = true;
export let closedReason = "starting up, have patience";
const loadClosed = async () => {
  const kitchenConfig = await prisma.kitchenConfig.upsert({
    where: {
      id: 0,
    },
    update: {},
    create: { id: 0 },
  });
  closed = kitchenConfig.closed;
  closedReason = kitchenConfig.closedReason;
};
loadClosed();

bot.registerButton("devtools:closed-toggle", async (interaction) => {
  if (closed) {
    closed = false;
    await prisma.kitchenConfig.update({
      where: {
        id: 0,
      },
      data: {
        closed: false,
      },
    });
    interaction.update({
      content: "Kitchen opened",
    });
    sendKitchenMessage(KitchenChannel.chefChat, {
      embeds: [
        {
          title: "Kitchen opened",
          footer: {
            text: `${interaction.user.username} - ${interaction.user.id}`,
          },
        },
      ],
    });
    sendKitchenMessage(KitchenChannel.logs, {
      content: `${emojiInline.materialDoorFront} <@!${interaction.user.id}> opened the kitchen`,
    });
  } else {
    const modal = new ModalBuilder()
      .setTitle("Close kitchen")
      .setCustomId("kitchen-close")
      .addComponents([
        new ActionRowBuilder<TextInputBuilder>().addComponents([
          new TextInputBuilder()
            .setCustomId("reason")
            .setLabel("Reason")
            .setRequired(false)
            .setStyle(TextInputStyle.Paragraph),
        ]),
      ]);
    interaction.showModal(modal);
  }
});

bot.registerModal("kitchen-close", async (interaction) => {
  const reason = interaction.fields.getTextInputValue("reason");
  closed = true;
  closedReason = reason;
  await prisma.kitchenConfig.update({
    where: {
      id: 0,
    },
    data: {
      closed: true,
      closedReason: reason,
    },
  });
  interaction.reply({
    content: "Kitchen closed",
    ephemeral: true,
  });
  sendKitchenMessage(KitchenChannel.chefChat, {
    embeds: [
      {
        title: "Kitchen closed",
        description: reason,
        footer: {
          text: `${interaction.user.username} - ${interaction.user.id}`,
        },
      },
    ],
  });
  sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialDoorFront} <@!${interaction.user.id}> closed the kitchen\n\`\`\`${reason}\`\`\``,
  });
});
