import crypto from 'crypto';
import prisma from '../db/prisma';
import { ALLOWED_ORDER_TRANSITIONS } from './orderStateMachine';

export const SIMULATION_DISCLAIMER = 'DEMO SIMULATION: Campus Bites operates in sandbox demonstration mode. No real financial transaction has occurred.';

export const WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || 'cb_simulated_webhook_secret_2026';

export interface WebhookPayload {
    event: 'payment.success' | 'payment.failed' | 'payment.refunded';
    orderId: number;
    paymentId?: string;
    amount?: number;
    currency?: string;
    timestamp?: string;
}

/**
 * Computes or verifies the HMAC-SHA256 signature for payment gateway webhooks.
 * Supports standard HMAC verification and dedicated sandbox testing tokens.
 */
export function verifyWebhookSignature(payloadString: string, signatureHeader?: string): boolean {
    if (!signatureHeader) return false;

    // Sandbox / Test bypass token
    if (signatureHeader === 'cb_simulated_valid_sig' || signatureHeader === 'sandbox_test_signature') {
        return true;
    }

    try {
        const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
        hmac.update(payloadString);
        const expectedSignature = hmac.digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
    } catch {
        return false;
    }
}

/**
 * Generates a valid simulated signature for a webhook payload (useful for automated tests and webhooks).
 */
export function generateWebhookSignature(payloadString: string): string {
    const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
    hmac.update(payloadString);
    return hmac.digest('hex');
}

/**
 * Processes a payment webhook event idempotently.
 * Prevents double fulfillment or double payment credit.
 */
export async function processPaymentWebhook(payload: WebhookPayload) {
    const { event, orderId, paymentId, amount } = payload;
    const oId = Number(orderId);

    return await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({
            where: { id: oId },
            include: { payments: true }
        });

        if (!order) {
            throw new Error(`NOT_FOUND: Order #${oId} not found`);
        }

        const existingPayment = order.payments[0];

        if (event === 'payment.success') {
            // Idempotency: if order is already PLACED and payment SUCCESS, safely no-op
            if (order.status !== 'PAYMENT_PENDING' && existingPayment?.status === 'SUCCESS') {
                return {
                    status: 'already_processed',
                    message: 'Payment already completed for this order (idempotent replay)',
                    orderId: order.id,
                    orderStatus: order.status,
                    paymentStatus: 'SUCCESS',
                    isDuplicate: true,
                    isSimulated: true
                };
            }

            // Update or create payment attempt
            if (existingPayment) {
                await tx.paymentAttempt.update({
                    where: { id: existingPayment.id },
                    data: { status: 'SUCCESS' }
                });
            } else {
                await tx.paymentAttempt.create({
                    data: {
                        orderId: order.id,
                        amount: amount || order.totalAmount,
                        status: 'SUCCESS'
                    }
                });
            }

            // Transition order fulfillment state from PAYMENT_PENDING -> PLACED
            const updatedOrder = await tx.order.update({
                where: { id: order.id },
                data: { status: 'PLACED' }
            });

            return {
                status: 'success',
                message: 'Payment succeeded and order transitioned to PLACED',
                orderId: updatedOrder.id,
                orderStatus: updatedOrder.status,
                paymentStatus: 'SUCCESS',
                isSimulated: true,
                simulationNotice: SIMULATION_DISCLAIMER
            };
        } else if (event === 'payment.failed') {
            if (existingPayment) {
                await tx.paymentAttempt.update({
                    where: { id: existingPayment.id },
                    data: { status: 'FAILED' }
                });
            } else {
                await tx.paymentAttempt.create({
                    data: {
                        orderId: order.id,
                        amount: amount || order.totalAmount,
                        status: 'FAILED'
                    }
                });
            }

            return {
                status: 'failed',
                message: 'Payment failed for order',
                orderId: order.id,
                orderStatus: order.status,
                paymentStatus: 'FAILED',
                isSimulated: true
            };
        } else if (event === 'payment.refunded') {
            if (existingPayment) {
                await tx.paymentAttempt.update({
                    where: { id: existingPayment.id },
                    data: { status: 'REFUNDED' }
                });
            }

            // Only transition to CANCELLED if order is not already completed
            let newStatus = order.status;
            if (order.status === 'PAYMENT_PENDING' || order.status === 'PLACED') {
                newStatus = 'CANCELLED';
                await tx.order.update({
                    where: { id: order.id },
                    data: { status: 'CANCELLED' }
                });
            }

            return {
                status: 'refunded',
                message: 'Payment refunded successfully',
                orderId: order.id,
                orderStatus: newStatus,
                paymentStatus: 'REFUNDED',
                isSimulated: true
            };
        }

        throw new Error(`UNSUPPORTED_EVENT: Unknown webhook event "${event}"`);
    });
}
