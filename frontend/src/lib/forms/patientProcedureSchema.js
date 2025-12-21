import { z } from 'zod';

export const patientProcedureSchema = z.object({
  child_first_name: z.string().min(1, 'Prénom requis'),
  child_last_name: z.string().min(1, 'Nom requis'),
  child_birthdate: z.string().min(1, 'Date de naissance requise'),
  child_weight_kg: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === '' || value === undefined ? null : Number(value)))
    .refine((value) => value === null || (!Number.isNaN(value) && value > 0), {
      message: 'Poids invalide',
    }),
  parent1_name: z.string().min(2, 'Nom du parent requis'),
  parent1_email: z.string().email('Email parent 1 invalide'),
  parent1_phone: z
    .string()
    .min(6, 'Telephone parent 1 requis')
    .regex(/^[+\d][\d\s-]+$/, 'Telephone invalide'),
  parent1_sms_optin: z.boolean().optional(),
  parent2_name: z.string().optional(),
  parent2_email: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /\S+@\S+\.\S+/.test(value), {
      message: 'Email parent 2 invalide',
    }),
  parent2_phone: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /^[+\d][\d\s-]+$/.test(value), {
      message: 'Telephone parent 2 invalide',
    }),
  parent2_sms_optin: z.boolean().optional(),
  parental_authority_ack: z.boolean().refine((value) => value, {
    message: "L'autorisation parentale est requise",
  }),
  notes: z.string().max(1000).optional(),
});

export const defaultProcedureValues = {
  child_first_name: '',
  child_last_name: '',
  child_birthdate: '',
  child_weight_kg: '',
  parent1_name: '',
  parent1_email: '',
  parent1_phone: '',
  parent1_sms_optin: true,
  parent2_name: '',
  parent2_email: '',
  parent2_phone: '',
  parent2_sms_optin: false,
  parental_authority_ack: false,
  notes: '',
};
