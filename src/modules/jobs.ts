import Agenda from "agenda";
import env from "../utils/env";

const agenda = new Agenda({
  db: { address: env.MONGO_URI },
});
export default agenda;

agenda.start();
