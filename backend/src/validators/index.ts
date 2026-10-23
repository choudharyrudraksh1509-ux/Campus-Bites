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
        const msg = error.issues.map(i => i.message).join(', ');
        res.status(400).json({ error: msg || 'Validation failed' });
      } else {
        res.status(400).json({ error: 'Validation failed' });
      }
    }
  };

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Name must be at least 2 characters').max(120),
    email: z.string().email('Invalid email address').max(150),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128),
    phone: z.string().max(20).optional().refine(val => {
      if (!val || !val.trim()) return true;
      const clean = val.trim().replace(/[\s\-\(\)]/g, '');
      const indianRegex = /^(?:\+91|91|0)?[6-9]\d{9}$/;
      const generalRegex = /^\+?[1-9]\d{9,14}$/;
      return indianRegex.test(clean) || generalRegex.test(clean);
    }, {
      message: 'Please enter a valid phone number (e.g. 9876543210)'
    }),
    // Public registration is restricted to CUSTOMER. Privilege elevation requires admin.
    role: z.literal('CUSTOMER').default('CUSTOMER').optional()
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1, 'Email or Staff ID is required').max(150),
    password: z.string().min(1, 'Password cannot be empty').max(128),
    shopId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional()
  })
});

export const placeOrderSchema = z.object({
  body: z.object({
    shopId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
    items: z.array(z.object({
      itemId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
      quantity: z.union([z.number().int().min(1).max(50), z.string().regex(/^\d+$/).transform(Number)]).refine(
        q => Number(q) >= 1 && Number(q) <= 50,
        { message: 'Quantity must be between 1 and 50' }
      )
    })).min(1, 'Order must contain at least one item').max(30, 'Cannot order more than 30 distinct items'),
    isPreorder: z.boolean().optional(),
    pickupTime: z.string().max(30).optional(),
    paymentMethod: z.string().max(50).optional(),
    idempotencyKey: z.string().max(128).optional(),
    autoConfirm: z.boolean().optional(),
    notes: z.string().max(250).optional()
  }).passthrough()
});

export const autobookScheduleSchema = z.object({
  body: z.object({
    shopId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
    itemId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
    quantity: z.union([z.number().int().min(1).max(20), z.string().regex(/^\d+$/).transform(Number)]).optional().default(1),
    scheduledTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Scheduled time must be in HH:mm 24-hour format'),
    isActive: z.boolean().optional().default(true)
  })
});

export const reviewSchema = z.object({
  body: z.object({
    shopId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
    rating: z.number().int().min(1, 'Rating must be at least 1').max(5, 'Rating cannot exceed 5'),
    comment: z.string().max(500, 'Comment cannot exceed 500 characters').optional(),
    orderId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional()
  })
});

export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PLACED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED', 'PAYMENT_PENDING', 'PAYMENT_FAILED'] as const)
  })
});

export const menuItemSchema = z.object({
  body: z.object({
    shopId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]).optional(),
    categoryId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)]),
    name: z.string().min(1, 'Item name is required').max(100),
    description: z.string().max(300).optional(),
    price: z.number().positive('Price must be greater than 0'),
    isAvailable: z.boolean().optional().default(true)
  })
});
