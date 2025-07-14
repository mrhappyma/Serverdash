import bot, { messagesClient } from "..";

const nicknameCache = new Map<string, string>();

export const getNickname = async (id: string) => {
  const cached = nicknameCache.get(id);
  if (cached) return cached;
  const user = await bot.client.users.fetch(id).catch(() => null);
  const nickname = user?.globalName || user?.username || "Unknown User";
  nicknameCache.set(id, nickname);
  return nickname;
};

messagesClient.client.on("userUpdate", async (oldUser, newUser) => {
  nicknameCache.set(newUser.id, newUser.globalName || newUser.username);
});
