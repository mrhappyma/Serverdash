import bot, { messagesClient } from "..";
import env from "../utils/env";

const nicknameCache = new Map<string, string>();

const kitchenGuild = bot.client.guilds.fetch(env.KITCHEN_SERVER_ID);

export const getNickname = async (id: string) => {
  const cached = nicknameCache.get(id);
  if (cached) return cached;
  const user = await (await kitchenGuild).members.fetch(id);
  const nickname = user.nickname || user.user.globalName || user.user.username;
  nicknameCache.set(id, nickname);
  return nickname;
};

messagesClient.client.on("guildMemberUpdate", async (oldMember, newMember) => {
  nicknameCache.set(
    newMember.id,
    newMember.nickname || newMember.user.globalName || newMember.user.username
  );
});
