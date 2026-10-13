/** Credenciales de un jugador (colección "accounts"). Solo las usa este backend */
export type Account = {
  userId: number;
  dname: string;
  passwordHash: string; // "salt:hash" de scrypt
  createdAt: Date;
  role?: "mod"; // moderador del chat. Se da a mano en Mongo (ver README)
  mutedUntil?: Date; // silenciado en el chat hasta esta fecha
};

/** Lo que devuelven /register y /login */
export type Session = {
  id: number;
  dname: string;
  token: string; // JWT para entrar al servidor de juego
};
