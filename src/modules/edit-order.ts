import {
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
} from "discord.js";
import bot, { messagesClient } from "..";
import { getOrder, updateOrder } from "../orders/cache";
import sendLogMessage from "../utils/log";
import updateOrderStatus, { sendOrderForFilling } from "../orders/updateStatus";
import { orderStatus } from "@prisma/client";

messagesClient.registerButton("devtools:edit-order", async (interaction) => {
  const modal = new ModalBuilder()
    .setTitle("Edit order")
    .setCustomId("devtools:edit-order:modal")
    .addComponents([
      new ActionRowBuilder<TextInputBuilder>().addComponents([
        new TextInputBuilder()
          .setCustomId("order")
          .setLabel("Order ID")
          .setRequired(true)
          .setStyle(TextInputStyle.Short)
          .setMinLength(1),
      ]),
    ]);
  return interaction.showModal(modal);
});

messagesClient.registerModal(
  "devtools:edit-order:modal",
  async (interaction) => {
    const id = interaction.fields.getTextInputValue("order");
    const order = await getOrder(parseInt(id));
    if (!order)
      return interaction.reply({
        content: "Order not found",
      });
    const a1 = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${order.id}:order`)
        .setLabel("order")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${order.id}:file`)
        .setLabel("file")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${order.id}:status`)
        .setLabel("status")
        .setStyle(ButtonStyle.Secondary),
    ]);
    return interaction.reply({
      components: [a1],
      ephemeral: true,
      content: `updating order **${order.id}** for **${order.order}**\n${order.status}`,
    });
  }
);

messagesClient.registerButton(
  /devtools:edit-order:(\d+):order/,
  async (interaction) => {
    const id = parseInt(interaction.customId.split(":")[2]);
    const order = await getOrder(id);
    if (!order)
      return interaction.reply({
        content: "Order not found",
        ephemeral: true,
      });
    const modal = new ModalBuilder()
      .setTitle("Edit order")
      .setCustomId(`devtools:edit-order:${order.id}:order:modal`)
      .addComponents([
        new ActionRowBuilder<TextInputBuilder>().addComponents([
          new TextInputBuilder()
            .setCustomId("order")
            .setLabel("Order")
            .setRequired(true)
            .setStyle(TextInputStyle.Paragraph)
            .setValue(order.order),
        ]),
      ]);
    return interaction.showModal(modal);
  }
);

messagesClient.registerModal(
  /devtools:edit-order:(\d+):order:modal/,
  async (interaction) => {
    const id = parseInt(interaction.customId.split(":")[2]);
    const newOrder = interaction.fields.getTextInputValue("order");
    const order = await updateOrder(id, { order: newOrder });
    await sendLogMessage(
      "materialEdit",
      `<@!${interaction.user.id}> changed order **#${order.id}** to **${order.order}**`,
      interaction.user.id
    );

    if (order.status == orderStatus.ORDERED) await sendOrderForFilling(order);
    if (order.status == orderStatus.FILLING)
      await updateOrderStatus({
        id: order.id,
        status: orderStatus.FILLING,
        chef: order.chefId!,
        chefUsername: order.chefUsername!,
        interactionMessageId: order.relatedKitchenMessages[0].split(":")[1],
        admin: interaction.user.id,
      });
    if (order.status == orderStatus.PACKED)
      await updateOrderStatus({
        id: order.id,
        status: orderStatus.PACKED,
        chef: interaction.user.id,
        chefUsername: interaction.user.username,
        admin: interaction.user.id,
      });

    return interaction.reply({
      content: `Order **${order.id}** updated`,
      ephemeral: true,
    });
  }
);

messagesClient.registerButton(
  /devtools:edit-order:(\d+):file/,
  async (interaction) => {
    const id = parseInt(interaction.customId.split(":")[2]);
    const order = await getOrder(id);
    if (!order)
      return interaction.reply({
        content: "Order not found",
        ephemeral: true,
      });
    const modal = new ModalBuilder()
      .setTitle("Edit order")
      .setCustomId(`devtools:edit-order:${order.id}:file:modal`)
      .addComponents([
        new ActionRowBuilder<TextInputBuilder>().addComponents([
          new TextInputBuilder()
            .setCustomId("file")
            .setLabel("File URL")
            .setRequired(false)
            .setStyle(TextInputStyle.Short)
            .setValue(order.fileUrl ?? ""),
        ]),
      ]);
    return interaction.showModal(modal);
  }
);

messagesClient.registerModal(
  /devtools:edit-order:(\d+):file:modal/,
  async (interaction) => {
    const id = parseInt(interaction.customId.split(":")[2]);
    const newFile = interaction.fields.getTextInputValue("file");
    const order = await updateOrder(id, { fileUrl: newFile });
    await sendLogMessage(
      "materialEdit",
      `<@!${interaction.user.id}> updated the file URL for order **#${order.id}**`,
      interaction.user.id
    );

    return interaction.reply({
      content: `Order **${order.id}** updated`,
      ephemeral: true,
    });
  }
);

messagesClient.registerButton(
  /devtools:edit-order:(\d+):status/,
  async (interaction) => {
    const id = parseInt(interaction.customId.split(":")[2]);
    const a1 = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents([
      new UserSelectMenuBuilder()
        .setCustomId(`devtools:edit-order:${id}:status:user`)
        .setPlaceholder("on behalf of who?"),
    ]);
    return interaction.update({
      content: `updating status of order **${id}**`,
      components: [a1],
    });
  }
);

messagesClient.registerUserSelectMenu(
  /devtools:edit-order:(\d+):status:user/,
  async (interaction) => {
    const id = parseInt(interaction.customId.split(":")[2]);
    const userId = interaction.values[0];
    const order = await getOrder(id);

    if (!order) return interaction.update({ content: "Order not found" });

    const a1 = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${id}:status:${userId}:ordered`)
        .setLabel("ordered")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${id}:status:${userId}:filling`)
        .setLabel("filling")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${id}:status:${userId}:packing`)
        .setLabel("packing")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${id}:status:${userId}:packed`)
        .setLabel("packed")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${id}:status:${userId}:delivering`)
        .setLabel("delivering")
        .setStyle(ButtonStyle.Secondary),
    ]);
    const a2 = new ActionRowBuilder<ButtonBuilder>().addComponents([
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${id}:status:${userId}:delivered`)
        .setLabel("delivered")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`devtools:edit-order:${id}:status:${userId}:rejected`)
        .setLabel("rejected")
        .setStyle(ButtonStyle.Danger),
    ]);
    return interaction.update({
      content: `updating status of order **${order.id}** for **${order.order}**\n${order.status}`,
      components: [a1, a2],
    });
  }
);

messagesClient.registerButton(
  /devtools:edit-order:(\d+):status:(\d+):(.+)/,
  async (interaction) => {
    const id = parseInt(interaction.customId.split(":")[2]);
    const userId = interaction.customId.split(":")[4];
    const status = interaction.customId
      .split(":")[5]
      .toUpperCase() as orderStatus;
    const order = await getOrder(id);
    if (!order)
      return interaction.reply({
        content: "Order not found",
        ephemeral: true,
      });
    if (order.status == orderStatus.PACKING) {
      return interaction.update({
        content:
          "not implemented, the packing scheduling thing rn is too janky to update the status of a packing order (:",
      });
    }

    if (status == orderStatus.ORDERED) {
      await sendOrderForFilling(order);
      await sendLogMessage(
        "materialEdit",
        `<@!${userId}> created order **#${id}** for **${order.order}**`,
        interaction.user.id
      );
      await interaction.update({
        content: `Order **${id}** updated`,
      });
    } else if (
      status == orderStatus.PACKING ||
      status == orderStatus.REJECTED ||
      status == orderStatus.PACKED
    ) {
      //im too tired to make this work independently and fetch all the data again so its just going to be like this
      const modalId = `devtools:edit-order:${id}:status:${userId}:${status}:modal:${Date.now()}`;
      const modal = new ModalBuilder()
        .setTitle("Edit order status")
        .setCustomId(modalId)
        .addComponents([
          new ActionRowBuilder<TextInputBuilder>().addComponents([
            new TextInputBuilder()
              .setCustomId("content")
              .setLabel(status == orderStatus.REJECTED ? "Reason" : "File URL")
              .setRequired(true)
              .setStyle(TextInputStyle.Short)
              .setValue(
                status == orderStatus.REJECTED
                  ? order.rejectedReason ?? ""
                  : order.fileUrl ?? ""
              ),
          ]),
        ]);
      await interaction.showModal(modal);
      bot.registerModal(modalId, async (interaction) => {
        const content = interaction.fields.getTextInputValue("content");
        if (status == orderStatus.REJECTED) {
          await updateOrderStatus({
            id,
            status,
            chef: userId,
            reason: content,
          });
        } else {
          await updateOrderStatus({
            id,
            status,
            chef: userId,
            chefUsername: await bot.client.users
              .fetch(userId)
              .then((u) => u.username),
            fileUrl: content,
          });
        }
        await interaction.reply({
          content: `Order **${id}** updated`,
          ephemeral: true,
        });
      });
    } else {
      console.log("status", status);
      const update = await updateOrderStatus({
        id,
        status,
        chef: userId,
        chefUsername: await bot.client.users
          .fetch(userId)
          .then((u) => u.username),
        admin: interaction.user.id,
      });
      if (update.success) {
        await interaction.update({
          content: `Order **${id}** updated`,
        });
      } else {
        await interaction.update({
          content: `Order **${id}** failed to update\n${update.message}`,
        });
      }
    }
  }
);
