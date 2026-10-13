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
  presence?: Presence; // la escribe el servidor de juego; si no existe, nunca se ha conectado
};

/** Lo necesario para dibujar una mascota tal como se ve en el juego (el frontend se lo pide al SWF) */
export type PetLook = {
  name: string;
  type: string; // especie: dog, monkey...
  gender: string;
  color1: string | number; // en la base hay de los dos: "0x6C6C6C" o 7105644
  color2: string | number;
  accessories: string[]; // la ropa que lleva puesta
  current: boolean; // si es la que usa ahora
};

/** Qué relación tienes con un jugador, vista desde ti */
export type Relation = "self" | "friends" | "outgoing" | "incoming" | "none"; // outgoing: le enviaste solicitud

/** Perfil de un jugador (GET /players/:id) */
export type PlayerProfile = {
  id: number;
  dname: string;
  level: number;
  wins: number;
  losses: number;
  gamecount: number; // partidas jugadas
  presence: Presence;
  pets: PetLook[]; // la que usa ahora tiene current: true
  mutualFriends: number; // amigos en común
  relation: Relation;
  blocked: boolean; // si tú lo bloqueaste
};

/** Dónde está el jugador ahora (lo actualiza el servidor de juego, ver docs/CUENTAS.md en Wild-Ones-Revival) */
export type Presence = "playing" | "lobby" | "offline";
