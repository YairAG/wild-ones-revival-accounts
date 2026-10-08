// Contadores para ids numéricos consecutivos (1, 2, 3...). Atómico: nunca da el mismo número dos veces.
import type { Db } from "mongodb";

type Counter = { _id: string; seq: number };

export async function nextId(db: Db, name: string): Promise<number> {
  const counter = await db
    .collection<Counter>("counters")
    .findOneAndUpdate(
      { _id: name },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
  return counter!.seq;
}
