import { z } from 'zod';

const phoneRegex = /^(0|\+84)(3[2-9]|5[6|8|9]|7[0|6-9]|8[1-9]|9[0-9])[0-9]{7}$/;

export const createLeadSchema = z.object({
  fullname: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(255),
  phone: z.string().regex(phoneRegex, 'Số điện thoại không hợp lệ'),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  note: z.string().max(2000, 'Ghi chú tối đa 2000 ký tự').optional().or(z.literal('')),
  source: z.string().max(255).optional().default('Landing Page'),
  utm_source: z.string().max(255).optional().or(z.literal('')),
  utm_medium: z.string().max(255).optional().or(z.literal('')),
});

export const updateLeadSchema = z.object({
  fullname: z.string().min(2, 'Họ tên phải có ít nhất 2 ký tự').max(255).optional(),
  phone: z.string().regex(phoneRegex, 'Số điện thoại không hợp lệ').optional(),
  email: z.string().email('Email không hợp lệ').optional().or(z.literal('')),
  note: z.string().max(2000).optional().or(z.literal('')),
  source: z.string().max(255).optional(),
  utm_source: z.string().max(255).optional().or(z.literal('')),
  utm_medium: z.string().max(255).optional().or(z.literal('')),
  status: z.enum(['NEW', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
