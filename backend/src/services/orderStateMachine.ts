export type OrderStatus = 
    | 'PAYMENT_PENDING' 
    | 'PLACED' 
    | 'PREPARING' 
    | 'READY' 
    | 'COMPLETED' 
    | 'CANCELLED';

export type PaymentStatus = 
    | 'PENDING' 
    | 'SUCCESS' 
    | 'FAILED' 
    | 'CANCELLED' 
    | 'REFUNDED';

/**
 * Strict Order Fulfillment State Machine Transitions
 * 
 * Linear forward path: PAYMENT_PENDING -> PLACED -> PREPARING -> READY -> COMPLETED
 * Permitted cancellations: PAYMENT_PENDING or PLACED -> CANCELLED
 * Terminal states: COMPLETED, CANCELLED
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    PAYMENT_PENDING: ['PLACED', 'CANCELLED'],
    PLACED: ['PREPARING', 'CANCELLED'],
    PREPARING: ['READY'],
    READY: ['COMPLETED'],
    COMPLETED: [],
    CANCELLED: []
};

/**
 * Validates whether an order status transition is permissible under the state machine.
 */
export function isValidOrderTransition(currentStatus: string, nextStatus: string): boolean {
    const from = currentStatus as OrderStatus;
    const to = nextStatus as OrderStatus;
    const allowed = ALLOWED_ORDER_TRANSITIONS[from];
    if (!allowed) {
        return false;
    }
    return allowed.includes(to);
}

/**
 * Validates whether an order can be cancelled by customer or staff.
 */
export function isCancellableOrderStatus(currentStatus: string): boolean {
    return currentStatus === 'PAYMENT_PENDING' || currentStatus === 'PLACED';
}
