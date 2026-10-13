// Validación del body de /register y /login.
import { z } from "zod";

export const credentialsSchema = z.object({
  dname: z
    .string()
    .regex(/^[a-zA-Z0-9_]{3,16}$/, "El nombre debe tener 3 a 16 letras, números o _"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres").max(128),
});

export type Credentials = z.infer<typeof credentialsSchema>;

// Body de /register: además, el correo (para recuperar la cuenta) y aceptar las reglas
export const registerSchema = credentialsSchema.extend({
  email: z.email("Escribe un correo válido").max(254).toLowerCase(),
  acceptTerms: z.literal(true, "Tienes que aceptar las reglas, la privacidad y los términos"),
});

// Body de POST /account/password
export const changePasswordSchema = z.object({
  current: z.string().min(1, "Escribe tu contraseña actual"),
  next: credentialsSchema.shape.password,
});

// Body de POST /account/privacy
export const privacySchema = z.object({
  dmPolicy: z.enum(["friends", "everyone", "nobody"], "Opción no válida"),
});

// Body de DELETE /account: se confirma con la contraseña
export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Escribe tu contraseña para confirmar"),
});
