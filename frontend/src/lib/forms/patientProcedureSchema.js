import { z } from 'zod';

export const patientProcedureSchema = z.object({
  child_full_name: z.string().min(2, 'Nom complet requis'),
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
  parent2_name: z.string().optional(),
  parent2_email: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((value) => (value ? value : null))
    .refine((value) => value === null || /\S+@\S+\.\S+/.test(value), {
      message: 'Email parent 2 invalide',
    }),
  parental_authority_ack: z.boolean().refine((value) => value, {
    message: "L'autorisation parentale est requise",
  }),
  notes: z.string().max(1000).optional(),
});

export const defaultProcedureValues = {
  child_full_name: '',
  child_birthdate: '',
  child_weight_kg: '',
  parent1_name: '',
  parent1_email: '',
  parent2_name: '',
  parent2_email: '',
  parental_authority_ack: false,
  notes: '',
};
