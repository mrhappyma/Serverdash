import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { messagesClient, prisma } from "..";
import { KitchenChannel, sendKitchenMessage } from "../utils/kitchenChannels";
import { emojiInline } from "../utils/emoji";

export let closed = true;
export let closedReason: string | undefined = "starting up, have patience";
const loadClosed = async () => {
  const activeKitchenClosed = await prisma.kitchenClosed.findFirst({
    where: {
      OR: [{ until: null }, { until: { gt: new Date() } }],
    },
    orderBy: {
      from: "desc",
    },
  });
  closed = activeKitchenClosed ? true : false;
  closedReason = activeKitchenClosed?.reason;
};
loadClosed();

messagesClient.registerButton("devtools:closed-toggle", async (interaction) => {
  if (closed) {
    closed = false;
    await prisma.kitchenClosed.updateMany({
      where: {
        OR: [{ until: null }, { until: { gt: new Date() } }],
      },
      data: {
        until: new Date(),
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
      allowedMentions: {
        parse: [],
      },
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

messagesClient.registerModal("kitchen-close", async (interaction) => {
  const reason = interaction.fields.getTextInputValue("reason");
  closed = true;
  closedReason = reason;
  await prisma.kitchenClosed.create({
    data: {
      by: interaction.user.id,
      reason,
    },
  });
  interaction.reply({
    content: "Kitchen closed",
    flags: [MessageFlags.Ephemeral],
  });
  sendKitchenMessage(KitchenChannel.chefChat, {
    embeds: [
      {
        title: "Kitchen closed",
        description: reason,
      },
    ],
  });
  sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline.materialDoorFront} <@!${interaction.user.id}> closed the kitchen\n\`\`\`${reason}\`\`\``,
    allowedMentions: {
      parse: [],
    },
  });
});
