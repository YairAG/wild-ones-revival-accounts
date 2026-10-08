// Validación del body de /register y /login.
import { z } from "zod";

export const credentialsSchema = z.object({
  dname: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,16}$/, "El nombre debe tener 3 a 16 letras, números o _"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
});

export type Credentials = z.infer<typeof credentialsSchema>;
