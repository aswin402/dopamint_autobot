import { z } from 'zod';

export const RoleEnum = z.enum(['ADMIN', 'USER', 'GUEST']);
export type Role = z.infer<typeof RoleEnum>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters').nullable(),
  role: RoleEnum,
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
});

export type User = z.infer<typeof UserSchema>;

export const PostSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(5, 'Content must be at least 5 characters').nullable(),
  published: z.boolean().default(false),
  views: z.number().int().nonnegative().default(0),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  authorId: z.string().uuid(),
});

export type Post = z.infer<typeof PostSchema>;

export const LoginFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormValues = z.infer<typeof LoginFormSchema>;

export const RegisterFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type RegisterFormValues = z.infer<typeof RegisterFormSchema>;

export const CreatePostSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  content: z.string().min(5, 'Content must be at least 5 characters'),
  published: z.boolean().default(false),
});

export type CreatePostValues = z.infer<typeof CreatePostSchema>;
