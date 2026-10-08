/** Mascota de un jugador */
export type Pet = {
  id: number;
  name: string;
  type: string;
  gender: string;
  pers: string;
  color1: string;
  color2: string;
  kills: number;
  deaths: number;
  accessories: string[];
};

/**
 * Jugador (colección "users"), con el formato que espera el servidor de juego (ver docs/CUENTAS.md en
 * Wild-Ones-Revival). Este backend solo lo crea; después lo modifica el servidor de juego.
 */
export type Player = {
  id: number;
  dname: string;
  nw: number;
  level: number;
  xp: number;
  gold: number;
  treats: number;
  hp: number;
  speed: number;
  attack: number;
  defence: number;
  jump: number;
  wins: number;
  losses: number;
  gamecount: number;
  sesscount: number;
  login_streak: number;
  status: string;
  playerStatus: string;
  net: string;
  currentPet: string;
  ownedPets: Record<string, Pet>;
  userWeaponsOwned: Record<string, number>;
  userWeaponsEquipped: string[];
  userAccessories: string[];
  durability: Record<string, number>;
  allowedMaps: string[];
};
