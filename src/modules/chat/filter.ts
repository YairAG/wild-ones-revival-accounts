// Filtro de groserías: las palabras de la lista (y su plural) se reemplazan por ***.
// Solo palabras completas y sin importar mayúsculas: "Pendejo" se tapa, "pendiente" no. La lista se ajusta aquí
const WORDS = [
  "pendejo",
  "pendeja",
  "puto",
  "puta",
  "verga",
  "chingada",
  "chingar",
  "culero",
  "culera",
  "cabron",
  "cabrona",
  "mierda",
  "pinche",
  "joto",
  "maricon",
  "marica",
  "zorra",
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "faggot",
  "nigger",
];

// \p{L}: cualquier letra, también con acento. Así "putón" no se toma como "puto" + "n"
const pattern = new RegExp(`(?<!\\p{L})(${WORDS.join("|")})(e?s)?(?!\\p{L})`, "giu");

export const filterText = (text: string) => text.replace(pattern, "***");
