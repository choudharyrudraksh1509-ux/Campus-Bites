import bcrypt from 'bcryptjs';
import prisma from '../db/prisma';

export interface StallCredential {
    id: number;
    name: string;
    slug: string;
    email: string;
    areaName: string;
    areaDesc: string;
}

export const STALL_CREDENTIALS: StallCredential[] = [
    { 
        id: 1, 
        name: 'Gazebo 1', 
        slug: 'gazebo1', 
        email: 'staff.gazebo1@campusbites.com', 
        areaName: 'Gazebo Complex',
        areaDesc: 'Central campus hotspot with Gazebo 1, Gazebo 2 & Fresh Juices'
    },
    { 
        id: 2, 
        name: 'Gazebo 2', 
        slug: 'gazebo2', 
        email: 'staff.gazebo2@campusbites.com', 
        areaName: 'Gazebo Complex',
        areaDesc: 'Central campus hotspot with Gazebo 1, Gazebo 2 & Fresh Juices'
    },
    { 
        id: 3, 
        name: 'Fresh Juices - Healthy & Tasty', 
        slug: 'freshjuices', 
        email: 'staff.freshjuices@campusbites.com', 
        areaName: 'Gazebo Complex',
        areaDesc: 'Central campus hotspot with Gazebo 1, Gazebo 2 & Fresh Juices'
    },
    { 
        id: 4, 
        name: 'Sri Outlet', 
        slug: 'sri', 
        email: 'staff.sri@campusbites.com', 
        areaName: 'North Square',
        areaDesc: 'North Square food hub featuring Sri, Diner, Bakers & South Corner'
    },
    { 
        id: 5, 
        name: 'North Square Diner', 
        slug: 'nsdiner', 
        email: 'staff.nsdiner@campusbites.com', 
        areaName: 'North Square',
        areaDesc: 'North Square food hub featuring Sri, Diner, Bakers & South Corner'
    },
    { 
        id: 6, 
        name: 'Campus Bakers', 
        slug: 'bakers', 
        email: 'staff.bakers@campusbites.com', 
        areaName: 'North Square',
        areaDesc: 'North Square food hub featuring Sri, Diner, Bakers & South Corner'
    },
    { 
        id: 7, 
        name: 'South Corner', 
        slug: 'southcorner', 
        email: 'staff.southcorner@campusbites.com', 
        areaName: 'North Square',
        areaDesc: 'North Square food hub featuring Sri, Diner, Bakers & South Corner'
    },
    { 
        id: 8, 
        name: 'Hunger Express', 
        slug: 'hunger', 
        email: 'staff.hunger@campusbites.com', 
        areaName: 'Hunger',
        areaDesc: 'Specialist in rolls, burgers, honey chilli potatoes & wraps'
    },
    { 
        id: 9, 
        name: 'Gymkhana Food Club', 
        slug: 'gymkhana', 
        email: 'staff.gymkhana@campusbites.com', 
        areaName: 'Gymkhana',
        areaDesc: 'Authentic Indian Sabzis, Naan, Tandoori Roti & Biryanis'
    },
];

/**
 * Ensures that all stall staff accounts exist, are correctly mapped to their shops,
 * and have working credentials (password123). Runs on server startup and login fallback.
 */
export async function ensureStallStaffSeeded(): Promise<void> {
    try {
        const passwordHash = await bcrypt.hash('password123', 10);

        // 1. Roles
        const roleStaff = await prisma.role.upsert({
            where: { name: 'STAFF' },
            update: {},
            create: { name: 'STAFF' }
        });
        await prisma.role.upsert({
            where: { name: 'CUSTOMER' },
            update: {},
            create: { name: 'CUSTOMER' }
        });
        const roleOwner = await prisma.role.upsert({
            where: { name: 'OWNER' },
            update: {},
            create: { name: 'OWNER' }
        });

        // 2. Owner / Admin user
        const owner = await prisma.user.upsert({
            where: { email: 'owner@campusbites.com' },
            update: { passwordHash },
            create: {
                fullName: 'Campus Admin',
                email: 'owner@campusbites.com',
                passwordHash
            }
        });
        await prisma.userRole.upsert({
            where: { userId_roleId: { userId: owner.id, roleId: roleOwner.id } },
            update: {},
            create: { userId: owner.id, roleId: roleOwner.id }
        });

        // 3. Stalls and Mapped Staff
        for (const s of STALL_CREDENTIALS) {
            const area = await prisma.area.upsert({
                where: { name: s.areaName },
                update: {},
                create: { name: s.areaName, description: s.areaDesc }
            });

            let shop = await prisma.shop.findFirst({
                where: {
                    OR: [
                        { name: s.name },
                        { id: s.id }
                    ]
                }
            });

            if (!shop) {
                shop = await prisma.shop.create({
                    data: {
                        name: s.name,
                        ownerId: owner.id,
                        areaId: area.id,
                        status: 'ACTIVE'
                    }
                });
            } else if (shop.status !== 'ACTIVE') {
                await prisma.shop.update({
                    where: { id: shop.id },
                    data: { status: 'ACTIVE' }
                });
            }

            // Create/update staff user
            const staffUser = await prisma.user.upsert({
                where: { email: s.email },
                update: {
                    fullName: `${s.name} Staff`,
                    passwordHash,
                    isActive: true
                },
                create: {
                    fullName: `${s.name} Staff`,
                    email: s.email,
                    passwordHash,
                    isActive: true
                }
            });

            // Assign STAFF role
            await prisma.userRole.upsert({
                where: { userId_roleId: { userId: staffUser.id, roleId: roleStaff.id } },
                update: {},
                create: { userId: staffUser.id, roleId: roleStaff.id }
            });

            // Map Staff to this specific Shop in ShopStaff
            await prisma.shopStaff.upsert({
                where: { shopId_staffId: { shopId: shop.id, staffId: staffUser.id } },
                update: {},
                create: { shopId: shop.id, staffId: staffUser.id }
            });
        }

        console.log('✅ Stall staff credentials verified and mapped successfully');
    } catch (error) {
        console.error('Error ensuring stall staff seed:', error);
    }
}
