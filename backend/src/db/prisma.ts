import { PrismaClient } from '@prisma/client';

/**
 * Authoritative Prisma database client singleton.
 * Prevents multiple instances and connection pool exhaustion across dev hot-reloads.
 * Connection strings and credentials are never logged.
 */
const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export default prisma;
