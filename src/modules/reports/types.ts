import type { ObjectId } from "mongodb";
import type { PlayerRef } from "../chat/types";

/** Motivos de reporte (el texto para el jugador lo pone el frontend) */
export const REPORT_REASONS = [
  "harassment", // lenguaje ofensivo o acoso
  "cheating", // trampas o hacks
  "inappropriate_name", // nombre o contenido inapropiado
  "spam", // spam o estafa
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Un reporte (colección "reports") */
export type StoredReport = {
  _id?: ObjectId;
  from: PlayerRef; // quién reporta (el reportado nunca lo sabe)
  target: PlayerRef;
  reason: ReportReason;
  details?: string;
  message?: { id: string; text: string; at: Date }; // el mensaje del chat adjunto, tal como está en la base
  status: "open" | "resolved";
  createdAt: Date;
  resolvedBy?: PlayerRef;
  resolvedAt?: Date;
};

/** Un reporte abierto en el panel de moderación */
export type OpenReport = {
  id: string;
  from: PlayerRef;
  target: PlayerRef;
  reason: ReportReason;
  details?: string;
  message?: { text: string; at: string };
  at: string; // cuándo se reportó, ISO
};
