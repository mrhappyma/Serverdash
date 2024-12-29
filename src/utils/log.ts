import { emojiInline } from "./emoji";
import { sendKitchenMessage, KitchenChannel } from "./kitchenChannels";

const sendLogMessage = async (
  emoji: keyof typeof emojiInline,
  message: string
) => {
  await sendKitchenMessage(KitchenChannel.logs, {
    content: `${emojiInline[emoji]} ${message}`,
    allowedMentions: { parse: [] },
  });
};

export default sendLogMessage;
