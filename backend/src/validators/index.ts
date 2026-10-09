import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const validateRequest = (schema: ZodSchema) => 
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation failed', details: error.issues });
      } else {
        res.status(400).json({ error: 'Validation failed' });
      }
    }
  };

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2).max(120),
    email: z.string().email().max(180),
    password: z.string().min(6).max(255),
    phone: z.string().max(20).optional(),
    role: z.enum(['CUSTOMER', 'STAFF', 'OWNER']).default('CUSTOMER')
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string()
  })
});

export const placeOrderSchema = z.object({
  body: z.object({
    shopId: z.number().int().positive(),
    items: z.array(z.object({
      itemId: z.number().int().positive(),
      quantity: z.number().int().positive()
    })).min(1)
  })
});
