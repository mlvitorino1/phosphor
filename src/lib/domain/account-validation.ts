import { z } from "zod";

const email = z.string().trim().max(254).email();
const password = z.string().min(1).max(256);
export const loginSchema = z.object({ email, password });
export const adminLoginSchema = z.object({ username: z.string().trim().max(80), password });
export const registrationSchema = z.object({
  email,
  password: password.min(12),
  name: z.string().trim().min(2).max(80),
});
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: password.min(12),
});
export const setupSchema = z.object({ password: password.min(12) });
