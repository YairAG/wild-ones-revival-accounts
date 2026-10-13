/** Un bloqueo (colección "blocks"): `from` bloqueó a `to`. Uno por pareja y sentido */
export type Block = {
  from: number;
  to: number;
  createdAt: Date;
};
