import bot from "..";

const getAutoFillFileURL = async (order: string) => {
  if (order == "really cool cat") {
    const file = await fetch("https://ginkgo-bot.vercel.app/api/ginkgo");
    const response = await file.json();
    return response.url as string;
  }

  if (/^<@!?(\d+)>$/.test(order)) {
    const mentionedUserId = order.match(/^<@!?(\d+)>$/)?.[1]!;
    const user = await bot.client.users
      .fetch(mentionedUserId)
      .catch(() => null);
    if (user) return user.displayAvatarURL();
  }
};

export default getAutoFillFileURL;
