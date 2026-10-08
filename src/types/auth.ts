/** Lo que devuelven /register y /login */
export type Session = {
  id: number;
  dname: string;
  token: string; // JWT para entrar al servidor de juego
};
