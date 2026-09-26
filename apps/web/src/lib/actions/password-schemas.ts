import { z } from "zod";

export const PasswordResetAcceptedResponseSchema = z.object({
  accepted: z.literal(true),
  deepLink: z.string().optional(),
});

export const PasswordResetValidationResponseSchema = z.object({
  valid: z.boolean(),
});

export const ChangePasswordResponseSchema = z.object({
  changed: z.literal(true),
});

export const ConfirmPasswordResetResponseSchema = z.object({
  confirmed: z.literal(true),
});

export const PasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .max(128, "Password must be at most 128 characters.")
  .refine((v) => !/\s/.test(v), { message: "Password must not contain whitespace." })
  .refine((v) => {
    let classes = 0;
    if (/[a-z]/.test(v)) classes += 1;
    if (/[A-Z]/.test(v)) classes += 1;
    if (/[0-9]/.test(v)) classes += 1;
    if (/[^A-Za-z0-9\s]/.test(v)) classes += 1;
    return classes >= 3;
  }, { message: "Password must include at least three of: lowercase, uppercase, digit, symbol." });

export const ChangePasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: PasswordSchema,
    confirmNewPassword: z.string().min(1, "Confirm the new password"),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "New password must differ from the current one",
    path: ["newPassword"],
  });

export const ResetPasswordFormSchema = z
  .object({
    newPassword: PasswordSchema,
    confirmNewPassword: z.string().min(1, "Confirm the new password"),
  })
  .refine((v) => v.newPassword === v.confirmNewPassword, {
    message: "Passwords do not match",
    path: ["confirmNewPassword"],
  });
