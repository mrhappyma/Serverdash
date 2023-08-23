import { order } from "@prisma/client";

const fillOrderMessage = (order: order, message: string) => {
  return message
    .replace("$mention", `<@${order.customerId}>`)
    .replace("$item", order.fileUrl!)
    .replace("$number", order.id.toString())
    .replace("$chef", order.chefUsername!)
    .replace("$order", order.order)
    .replace("$server", order.guildName!);
};
export default fillOrderMessage;
