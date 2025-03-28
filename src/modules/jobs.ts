import Agenda from "agenda";
import env from "../utils/env";
import bot from "..";

const agenda = new Agenda({
  db: { address: env.MONGO_URI },
});
export default agenda;

bot.client.once("ready", () => {
  agenda.start();
});
