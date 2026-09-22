import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const dbUrl = process.env.DATABASE_URL || "";
  const isPostgres = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://");

  let adapter: any;

  if (isPostgres) {
    const pool = new Pool({ connectionString: dbUrl });
    adapter = new PrismaPg(pool);
  } else {
    const fileUrl = dbUrl.startsWith("file:")
      ? dbUrl
      : `file:${path.resolve(process.cwd(), "dev.db")}`;
    adapter = new PrismaLibSql({
      url: fileUrl,
    });
  }

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

