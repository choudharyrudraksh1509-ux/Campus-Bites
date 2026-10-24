import prisma from '../src/db/prisma';

async function runVerification() {
  console.log('====================================================');
  console.log('🧪 RUNNING DATABASE ARCHITECTURE & RELATIONSHIP TESTS');
  console.log('====================================================');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Uniqueness Constraints Test
  await test('User email uniqueness constraint is enforced', async () => {
    const existing = await prisma.user.findFirst();
    if (!existing) throw new Error('No user found to test uniqueness');

    try {
      await prisma.user.create({
        data: {
          fullName: 'Duplicate Test User',
          email: existing.email,
          passwordHash: 'dummy'
        }
      });
      throw new Error('Expected duplicate email insertion to throw error, but it succeeded');
    } catch (err: any) {
      if (err.code === 'P2002' || err.message.includes('Unique constraint')) {
        // Expected P2002 unique constraint violation
        return;
      }
      throw err;
    }
  });

  // 2. ShopStaff Unique Constraint Test
  await test('ShopStaff compound uniqueness (shopId + staffId) is enforced', async () => {
    const existing = await prisma.shopStaff.findFirst();
    if (!existing) throw new Error('No shopStaff found');

    try {
      await prisma.shopStaff.create({
        data: {
          shopId: existing.shopId,
          staffId: existing.staffId
        }
      });
      throw new Error('Expected duplicate shopStaff insertion to throw error, but it succeeded');
    } catch (err: any) {
      if (err.code === 'P2002' || err.message.includes('Unique constraint')) {
        return;
      }
      throw err;
    }
  });

  // 3. Foreign Key Constraint on Order
  await test('Order foreign key validation prevents orders with invalid customerId', async () => {
    const shop = await prisma.shop.findFirst();
    if (!shop) throw new Error('No shop found');

    try {
      await prisma.order.create({
        data: {
          customerId: 9999999, // Non-existent user
          shopId: shop.id,
          totalAmount: 100,
          status: 'PENDING'
        }
      });
      throw new Error('Expected invalid foreign key to throw error, but it succeeded');
    } catch (err: any) {
      if (err.code === 'P2003' || err.message.includes('Foreign key constraint')) {
        return;
      }
      throw err;
    }
  });

  // 4. Autobook Foreign Key & Relationship Test
  await test('AutobookSchedule foreign key constraint validates user, shop, and item', async () => {
    try {
      await prisma.autobookSchedule.create({
        data: {
          userId: 9999999, // Invalid user
          shopId: 1,
          itemId: 1,
          scheduledTime: '08:00'
        }
      });
      throw new Error('Expected invalid foreign key to throw error, but it succeeded');
    } catch (err: any) {
      if (err.code === 'P2003' || err.message.includes('Foreign key constraint')) {
        return;
      }
      throw err;
    }
  });

  // 5. Main Customer Ordering Flow Integration Test
  let testOrderId: number | null = null;
  let testUserId: number | null = null;

  await test('Full Customer Order Lifecycle (Create -> Item -> Payment -> Status Update -> Clean)', async () => {
    // A. Create a temporary customer
    const testCustomer = await prisma.user.create({
      data: {
        fullName: 'Test Order Flow Customer',
        email: `test-flow-${Date.now()}@campusbites.test`,
        passwordHash: 'dummy-hash',
        phone: '9999999999'
      }
    });
    testUserId = testCustomer.id;

    // B. Find an active shop and available item
    const shop = await prisma.shop.findFirst({
      where: { status: 'ACTIVE', items: { some: { isAvailable: true } } },
      include: { items: { where: { isAvailable: true } } }
    });
    if (!shop || shop.items.length === 0) throw new Error('No active shop with items found');

    const item = shop.items[0];

    // C. Place order with transaction
    const order = await prisma.order.create({
      data: {
        customerId: testCustomer.id,
        shopId: shop.id,
        status: 'PLACED',
        totalAmount: item.price * 2,
        estimatedMinutes: 15,
        queueNumber: 1,
        items: {
          create: [
            {
              itemId: item.id,
              quantity: 2,
              priceAtOrder: item.price
            }
          ]
        },
        payments: {
          create: {
            amount: item.price * 2,
            status: 'SUCCESS'
          }
        }
      },
      include: {
        items: { include: { item: true } },
        payments: true
      }
    });
    testOrderId = order.id;

    if (order.items.length !== 1) throw new Error('Order items count mismatch');
    if (order.payments.length !== 1) throw new Error('Order payments count mismatch');
    if (order.totalAmount !== item.price * 2) throw new Error('Total amount mismatch');

    // D. Update order status to PREPARING
    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PREPARING' }
    });
    if (updated.status !== 'PREPARING') throw new Error('Order status update failed');

    // E. Verify relations query
    const fetched = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        customer: true,
        shop: true,
        items: true,
        payments: true
      }
    });
    if (!fetched?.customer || !fetched?.shop) throw new Error('Failed to fetch relations');
  });

  // 6. Cascade Delete Verification
  await test('Cascade delete cleans up child OrderItem and PaymentAttempt on order removal', async () => {
    if (!testOrderId) throw new Error('No test order ID to test cascade');

    // Delete the test order
    await prisma.order.delete({ where: { id: testOrderId } });

    // Verify child items were cascade-deleted
    const items = await prisma.orderItem.findMany({ where: { orderId: testOrderId } });
    const payments = await prisma.paymentAttempt.findMany({ where: { orderId: testOrderId } });

    if (items.length !== 0) throw new Error(`Expected 0 order items, found ${items.length}`);
    if (payments.length !== 0) throw new Error(`Expected 0 payments, found ${payments.length}`);

    // Clean up test customer
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }
  });

  console.log('====================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  await prisma.$disconnect();

  if (failed > 0) {
    process.exit(1);
  }
}

runVerification();
