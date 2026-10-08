// Jugador recién registrado. Los valores iniciales son decisiones de diseño del juego: se ajustan aquí.
import type { Player } from "./types";

export function newPlayer(id: number, dname: string): Player {
  return {
    id,
    dname,
    nw: 0, // jugador nuevo (el cliente lo pone en -1 al terminar el tutorial)
    level: 0,
    xp: 0,
    gold: 1000,
    treats: 200,
    hp: 900,
    speed: 5,
    attack: 100,
    defence: 5,
    jump: 5,
    wins: 0,
    losses: 0,
    gamecount: 0,
    sesscount: 0,
    login_streak: 0,
    status: "playing",
    playerStatus: "playing",
    net: "M",
    currentPet: "1",
    ownedPets: {
      "1": {
        id: 1,
        name: dname,
        type: "dog",
        gender: "M",
        pers: "brave",
        color1: "0x6C6C6C",
        color2: "0xE1E2E3",
        kills: 0,
        deaths: 0,
        accessories: [],
      },
    },
    userWeaponsOwned: {},
    userWeaponsEquipped: ["walk", "bone", "superjump", "climb", "punch", "dig", "mortar"],
    userAccessories: [],
    durability: {},
    allowedMaps: ["Sink or Swim"],
  };
}
