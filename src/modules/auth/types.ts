/** Credenciales de un jugador (colección "accounts"). Solo las usa este backend */
export type Account = {
  userId: number;
  dname: string;
  passwordHash: string; // "salt:hash" de scrypt
  createdAt: Date;
};

/** Lo que devuelven /register y /login */
export type Session = {
  id: number;
  dname: string;
  token: string; // JWT para entrar al servidor de juego
};
