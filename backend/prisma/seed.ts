import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CampusBite Database...');
  const passwordHash = await bcrypt.hash('password123', 10);

  // Roles
  const roleCustomer = await prisma.role.upsert({ where: { name: 'CUSTOMER' }, update: {}, create: { name: 'CUSTOMER' } });
  const roleStaff = await prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } });
  const roleOwner = await prisma.role.upsert({ where: { name: 'OWNER' }, update: {}, create: { name: 'OWNER' } });

  // Users
  const staff = await prisma.user.upsert({
    where: { email: 'staff@campusbites.com' },
    update: {},
    create: { fullName: 'Rajesh Staff', email: 'staff@campusbites.com', passwordHash }
  });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: staff.id, roleId: roleStaff.id } }, update: {}, create: { userId: staff.id, roleId: roleStaff.id } });

  const owner = await prisma.user.upsert({
    where: { email: 'owner@campusbites.com' },
    update: {},
    create: { fullName: 'Vikram Owner', email: 'owner@campusbites.com', passwordHash }
  });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: owner.id, roleId: roleOwner.id } }, update: {}, create: { userId: owner.id, roleId: roleOwner.id } });

  // Areas (Campus Complexes)
  const gazeboArea = await prisma.area.upsert({
    where: { name: 'Gazebo Complex' },
    update: {},
    create: { name: 'Gazebo Complex', description: 'Central campus hotspot with Gazebo 1, Gazebo 2 & Fresh Juices' }
  });

  const northSquareArea = await prisma.area.upsert({
    where: { name: 'North Square' },
    update: {},
    create: { name: 'North Square', description: 'North Square food hub featuring Sri, Diner, Bakers & South Corner' }
  });

  const hungerArea = await prisma.area.upsert({
    where: { name: 'Hunger' },
    update: {},
    create: { name: 'Hunger', description: 'Specialist in rolls, burgers, honey chilli potatoes & wraps' }
  });

  const gymkhanaArea = await prisma.area.upsert({
    where: { name: 'Gymkhana' },
    update: {},
    create: { name: 'Gymkhana', description: 'Authentic Indian Sabzis, Naan, Tandoori Roti & Biryanis' }
  });

  // Outlets Setup helper
  const createShop = async (name: string, areaId: number) => {
    let shop = await prisma.shop.findFirst({ where: { name } });
    if (!shop) {
      shop = await prisma.shop.create({
        data: { name, ownerId: owner.id, areaId, status: 'ACTIVE' }
      });
    }
    return shop;
  };

  const g1 = await createShop('Gazebo 1', gazeboArea.id);
  const g2 = await createShop('Gazebo 2', gazeboArea.id);
  const freshJuices = await createShop('Fresh Juices - Healthy & Tasty', gazeboArea.id);

  const sri = await createShop('Sri Outlet', northSquareArea.id);
  const nsDiner = await createShop('North Square Diner', northSquareArea.id);
  const bakers = await createShop('Campus Bakers', northSquareArea.id);
  const southCorner = await createShop('South Corner', northSquareArea.id);

  const hunger = await createShop('Hunger Express', hungerArea.id);
  const gymkhana = await createShop('Gymkhana Food Club', gymkhanaArea.id);

  // --- SEPARATE LOGIN CREDENTIALS FOR EACH STALL ---
  const stallStaffList = [
    { name: 'Gazebo 1 Staff', email: 'staff.gazebo1@campusbites.com', shopId: g1.id },
    { name: 'Gazebo 2 Staff', email: 'staff.gazebo2@campusbites.com', shopId: g2.id },
    { name: 'Fresh Juices Staff', email: 'staff.freshjuices@campusbites.com', shopId: freshJuices.id },
    { name: 'Sri Outlet Staff', email: 'staff.sri@campusbites.com', shopId: sri.id },
    { name: 'North Square Diner Staff', email: 'staff.nsdiner@campusbites.com', shopId: nsDiner.id },
    { name: 'Campus Bakers Staff', email: 'staff.bakers@campusbites.com', shopId: bakers.id },
    { name: 'South Corner Staff', email: 'staff.southcorner@campusbites.com', shopId: southCorner.id },
    { name: 'Hunger Express Staff', email: 'staff.hunger@campusbites.com', shopId: hunger.id },
    { name: 'Gymkhana Food Club Staff', email: 'staff.gymkhana@campusbites.com', shopId: gymkhana.id },
  ];

  for (const s of stallStaffList) {
    const sUser = await prisma.user.upsert({
      where: { email: s.email },
      update: { fullName: s.name, passwordHash },
      create: { fullName: s.name, email: s.email, passwordHash }
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: sUser.id, roleId: roleStaff.id } },
      update: {},
      create: { userId: sUser.id, roleId: roleStaff.id }
    });

    await prisma.shopStaff.upsert({
      where: { shopId_staffId: { shopId: s.shopId, staffId: sUser.id } },
      update: {},
      create: { shopId: s.shopId, staffId: sUser.id }
    });
  }

  // Link legacy common staff to Gazebo 1 as backup
  await prisma.shopStaff.upsert({
    where: { shopId_staffId: { shopId: g1.id, staffId: staff.id } },
    update: {},
    create: { shopId: g1.id, staffId: staff.id }
  });

  // Categories
  const getCat = async (name: string) => {
    return prisma.category.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  };

  const catDrinks = await getCat('Drinks & Beverages');
  const catJuice = await getCat('Fresh Juices');
  const catShakes = await getCat('Milkshakes');
  const catDosa = await getCat('Dosa & South Indian');
  const catChaat = await getCat('Chaat & Street Food');
  const catSnacks = await getCat('Snacks & Starters');
  const catMaggi = await getCat('Maggi & Noodles');
  const catRolls = await getCat('Rolls & Wraps');
  const catBurgers = await getCat('Burgers & Fries');
  const catMains = await getCat('Curries, Sabzi & Biryani');
  const catBreads = await getCat('Breads & Naan');

  // Helper to add items cleanly
  const addItem = async (shopId: number, categoryId: number, name: string, price: number, description?: string) => {
    const existing = await prisma.foodItem.findFirst({ where: { shopId, name } });
    if (!existing) {
      await prisma.foodItem.create({
        data: { shopId, categoryId, name, price, description: description || '', isAvailable: true }
      });
    }
  };

  // --- SEED GAZEBO 1 ---
  await addItem(g1.id, catBurgers.id, 'Crispy Veg Cheese Burger', 85, 'Golden veg patty with melted cheddar');
  await addItem(g1.id, catBurgers.id, 'Paneer Loaded Fries', 95, 'Seasoned fries topped with spiced paneer');
  await addItem(g1.id, catSnacks.id, 'Double Cheese Pizza', 150, 'Freshly baked pan pizza with extra mozzarella');
  await addItem(g1.id, catDrinks.id, 'Cold Coffee with Ice Cream', 70, 'Chilled espresso blended with vanilla scoop');

  // --- SEED GAZEBO 2 ---
  await addItem(g2.id, catRolls.id, 'Chicken Kathi Roll', 110, 'Spiced chicken tikka wrapped in flaky paratha');
  await addItem(g2.id, catBurgers.id, 'Chicken Cheese Burger', 110, 'Juicy grilled chicken patty with cheese');
  await addItem(g2.id, catSnacks.id, 'Hot & Spicy Wings', 140, 'Crispy chicken wings tossed in hot glaze');

  // --- SEED FRESH JUICES (HEALTHY & TASTY PRICE LIST) ---
  const fjItems = [
    // Drinks
    { c: catDrinks.id, n: 'Tea', p: 15 },
    { c: catDrinks.id, n: 'Coffee', p: 15 },
    { c: catDrinks.id, n: 'Filter Coffee', p: 25 },
    { c: catDrinks.id, n: 'Badam / Ragi Malt', p: 30 },
    { c: catDrinks.id, n: 'Nannari Sarbath', p: 30 },
    { c: catDrinks.id, n: 'Buttermilk', p: 30 },
    { c: catDrinks.id, n: 'Rosemilk', p: 50 },
    // Juices
    { c: catJuice.id, n: 'Sugarcane Juice', p: 40 },
    { c: catJuice.id, n: 'Vazhaithandu Juice', p: 50 },
    { c: catJuice.id, n: 'Carrot Juice', p: 50 },
    { c: catJuice.id, n: 'Beetroot Juice', p: 50 },
    // Milkshakes
    { c: catShakes.id, n: 'Pineapple Milkshake', p: 70 },
    { c: catShakes.id, n: 'Banana Milkshake', p: 70 },
    { c: catShakes.id, n: 'Strawberry Milkshake', p: 80 },
    { c: catShakes.id, n: 'Pomegranate Milkshake', p: 80 },
    { c: catShakes.id, n: 'Chiku Milkshake', p: 80 },
    { c: catShakes.id, n: 'Mango Milkshake', p: 80 },
    // Dosa & Tiffin
    { c: catDosa.id, n: 'Idli (2 Pcs)', p: 35 },
    { c: catDosa.id, n: 'Set Dosa', p: 50 },
    { c: catDosa.id, n: 'Adai Dosa (4 Dhalls)', p: 60 },
    { c: catDosa.id, n: 'Curry Leaf Dosa', p: 60 },
    { c: catDosa.id, n: 'Drumstick Leaf Dosa', p: 60 },
    { c: catDosa.id, n: 'Ragi Dosa', p: 60 },
    { c: catDosa.id, n: 'Kambu (Rye) Dosa', p: 60 },
    { c: catDosa.id, n: 'Dhall Podi Dosa (Sesame)', p: 70 },
    { c: catDosa.id, n: 'Egg Dosa', p: 70 },
    // Chaat & Snacks
    { c: catChaat.id, n: 'Masala Poori', p: 50 },
    { c: catChaat.id, n: 'Dahi Bhel Poori', p: 60 },
    { c: catChaat.id, n: 'Pani Poori', p: 50 },
    { c: catChaat.id, n: 'Sev Poori', p: 50 },
    { c: catChaat.id, n: 'Channa Samosa', p: 50 },
    { c: catChaat.id, n: 'Dahi Samosa', p: 50 },
    { c: catChaat.id, n: 'Cutlet Channa', p: 50 },
    { c: catChaat.id, n: 'Aloo Chaat', p: 50 },
    { c: catChaat.id, n: 'Mushroom Fry Masala', p: 50 },
    { c: catChaat.id, n: 'Vada Pav', p: 50 },
    { c: catChaat.id, n: 'Pav Bhaji', p: 70 },
    // Snacks
    { c: catSnacks.id, n: 'Sundal (Channa)', p: 30 },
    { c: catSnacks.id, n: 'Vegetable Cutlet (2 Pcs)', p: 30 },
    { c: catSnacks.id, n: 'Veg Samosa (2 Pcs)', p: 30 },
    { c: catSnacks.id, n: 'Kuzhi Paniyaram (4 Pcs)', p: 30 },
    { c: catSnacks.id, n: 'Keerai Vadai (2 Pcs)', p: 30 },
    { c: catSnacks.id, n: 'Veg Bajji (3 Pcs)', p: 30 },
    { c: catSnacks.id, n: 'Spring Potato', p: 50 },
    { c: catSnacks.id, n: 'Potato Pops', p: 50 },
    { c: catSnacks.id, n: 'Millets & Sprouts Sandwich', p: 70 },
    { c: catSnacks.id, n: 'Millets & Sprouts Wrap', p: 80 },
    { c: catRolls.id, n: 'Regular Chicken Shawarma', p: 90 },
    { c: catRolls.id, n: 'Spl. Whole Chicken Shawarma', p: 130 },
  ];

  for (const it of fjItems) {
    await addItem(freshJuices.id, it.c, it.n, it.p);
  }

  // --- SEED SRI OUTLET (NORTH SQUARE) ---
  await addItem(sri.id, catMaggi.id, 'Classic Maggi', 30, 'Hot comforting masala maggi');
  await addItem(sri.id, catMaggi.id, 'Cheese Maggi', 45, 'Loaded with melted cheddar cheese');
  await addItem(sri.id, catSnacks.id, 'Crispy Veg Puff', 30, 'Flaky puff filled with spicy potatoes');
  await addItem(sri.id, catSnacks.id, 'Hot Veg Samosa', 30, 'Crispy traditional samosa');
  await addItem(sri.id, catDrinks.id, 'Hot Chai', 15, 'Freshly brewed masala tea');
  await addItem(sri.id, catDrinks.id, 'Hot Coffee', 15, 'Rich aromatic South Indian coffee');

  // --- SEED NORTH SQUARE DINER ---
  await addItem(nsDiner.id, catMains.id, 'Special Chole Bhature (2 Pcs)', 80, 'Spicy Punjabi chole with fluffy bhaturas');
  await addItem(nsDiner.id, catMains.id, 'Rajma Chawal Bowl', 80, 'Homestyle rajma served with steamed rice');
  await addItem(nsDiner.id, catChaat.id, 'Bombay Pav Bhaji', 70, 'Buttery mashed veg curry with toasted pav');

  // --- SEED CAMPUS BAKERS ---
  await addItem(bakers.id, catSnacks.id, 'Grilled Veg Sandwich', 60, 'Toasted sandwich with garden veggies');
  await addItem(bakers.id, catSnacks.id, 'Paneer Tikka Sandwich', 85, 'Spiced paneer cubes grilled in jumbo bread');
  await addItem(bakers.id, catSnacks.id, 'Chocolate Brownie', 50, 'Warm fudge brownie with walnut chunks');

  // --- SEED SOUTH CORNER ---
  await addItem(southCorner.id, catDosa.id, 'Masala Dosa', 60, 'Crispy golden dosa with potato masala');
  await addItem(southCorner.id, catDosa.id, 'Ghee Podi Idli (4 Pcs)', 55, 'Mini idlis tossed in roasted podi & ghee');
  await addItem(southCorner.id, catDosa.id, 'Medu Vada (2 Pcs)', 40, 'Crispy lentil vadas served with sambar & chutney');

  // --- SEED HUNGER ---
  await addItem(hunger.id, catRolls.id, 'Classic Veg Frankie Roll', 60, 'Spiced veg patty roll in kathi paratha');
  await addItem(hunger.id, catRolls.id, 'Chicken Kathi Roll', 80, 'Juicy marinated chicken wrapped with onions & sauce');
  await addItem(hunger.id, catBurgers.id, 'Classic Veg Burger', 70, 'Crispy veg patty burger');
  await addItem(hunger.id, catBurgers.id, 'Crispy Chicken Burger', 95, 'Crispy fried chicken breast burger');
  await addItem(hunger.id, catBurgers.id, 'Peri Peri French Fries', 60, 'Crispy potato fries tossed in peri peri spice');
  await addItem(hunger.id, catSnacks.id, 'Honey Chilli Potato', 90, 'Wok-tossed crispy potatoes in sweet & spicy sauce');
  await addItem(hunger.id, catRolls.id, 'Paneer Tikka Wrap', 85, 'Grilled paneer cubes wrapped in tortilla');

  // --- SEED GYMKHANA ---
  await addItem(gymkhana.id, catMains.id, 'Paneer Lababdar', 160, 'Rich gravy with cottage cheese cubes & cream');
  await addItem(gymkhana.id, catMains.id, 'Paneer Tikka Masala', 170, 'Chargrilled paneer in spicy onion tomato gravy');
  await addItem(gymkhana.id, catBreads.id, 'Garlic Butter Naan', 40, 'Clay oven tandoori naan brushed with garlic & butter');
  await addItem(gymkhana.id, catBreads.id, 'Tandoori Roti', 20, 'Traditional whole wheat tandoori roti');
  await addItem(gymkhana.id, catMains.id, 'Hyderabadi Veg Dum Biryani', 120, 'Fragrant basmati rice cooked with exotic vegetables');
  await addItem(gymkhana.id, catMains.id, 'Special Chicken Dum Biryani', 160, 'Aromatic basmati rice layered with succulent chicken');

  console.log('CampusBite database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
