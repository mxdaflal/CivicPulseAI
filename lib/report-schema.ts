import { z } from "zod";
export const categories = [
  "Water Supply",
  "Garbage Overflow",
  "Damaged Road",
  "Drainage Problem",
  "Streetlight Failure",
  "Public Transport",
] as const;
export const reportSchema = z
  .object({
    category: z.enum(categories),
    title: z.string().trim().min(5).max(150),
    description: z.string().trim().min(20).max(2000),
    locationText: z.string().trim().min(3).max(300),
    latitude: z.number().finite().min(-90).max(90).nullable().default(null),
    longitude: z.number().finite().min(-180).max(180).nullable().default(null),
    accuracy: z
      .number()
      .finite()
      .nonnegative()
      .max(100000)
      .nullable()
      .optional(),
    photoPath: z
      .string()
      .max(300)
      .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/)
      .nullable()
      .default(null),
    requestKey: z.string().uuid(),
    captchaToken: z.string().max(2048).optional(),
  })
  .strict()
  .refine(
    (d) => (d.latitude === null) === (d.longitude === null),
    "Both coordinates are required together",
  );
export type ReportInput = z.input<typeof reportSchema>;
export const trackingSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^CP-[A-Za-z0-9]+$/i),
    secret: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .or(z.literal(""))
      .default(""),
  })
  .strict();
export function validImageHeader(bytes: Uint8Array, mime: string) {
  return (
    (mime === "image/jpeg" &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255) ||
    (mime === "image/png" &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((x, i) => bytes[i] === x)) ||
    (mime === "image/webp" &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP")
  );
}
