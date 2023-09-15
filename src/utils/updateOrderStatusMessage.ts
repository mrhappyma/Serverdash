import { EmbedBuilder } from "discord.js";
import bot from "..";

const updateOrderStatusMessage = async (
  guildId: string,
  channelId: string,
  messageId: string,
  content: string
) => {
  const orderChannel = await (
    await bot.client.guilds.fetch(guildId)
  ).channels.fetch(channelId);
  if (!orderChannel?.isTextBased()) return false;
  const orderMessage = await orderChannel.messages.fetch(messageId);
  orderMessage.edit({
    embeds: [EmbedBuilder.from(orderMessage.embeds[0]).setDescription(content)],
  });
  return true;
};
export default updateOrderStatusMessage;
