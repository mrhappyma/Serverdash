import { emojiInline } from "./emoji";
import { sendKitchenMessage, KitchenChannel } from "./kitchenChannels";

const sendLogMessage = async (
  emoji: keyof typeof emojiInline,
  message: string,
  admin?: string
) => {
  let content = `${emojiInline[emoji]} ${message}`;
  if (admin) content += `\n-# manual action by admin <@!${admin}>`;
  await sendKitchenMessage(KitchenChannel.logs, {
    content,
    allowedMentions: { parse: [] },
  });
};

export default sendLogMessage;
