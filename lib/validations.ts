import { z } from 'zod';

export const citizenLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),
});

export const staffLoginSchema = z.object({
  staffId: z
    .string()
    .min(3, 'Staff ID is required')
    .max(50, 'Staff ID is too long')
    .regex(/^[a-zA-Z0-9\-_]+$/, 'Staff ID can only contain letters, numbers, hyphens, and underscores'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),
});

export const citizenSignupSchema = z.object({
  fullName: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name is too long'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password is too long'),
});

export const complaintSchema = z.object({
  category: z.string().min(1, 'Please select a category'),
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(150, 'Title is too long'),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(2000, 'Description is too long'),
  locationText: z
    .string()
    .max(300, 'Location text is too long')
    .optional()
    .or(z.literal('')),
});

export type CitizenLoginValues = z.infer<typeof citizenLoginSchema>;
export type StaffLoginValues = z.infer<typeof staffLoginSchema>;
export type CitizenSignupValues = z.infer<typeof citizenSignupSchema>;
export type ComplaintValues = z.infer<typeof complaintSchema>;
