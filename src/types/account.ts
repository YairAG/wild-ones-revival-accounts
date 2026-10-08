/** Credenciales de un jugador (colección "accounts"). Solo las usa este backend */
export type Account = {
  userId: number;
  dname: string;
  passwordHash: string; // "salt:hash" de scrypt
  createdAt: Date;
};
