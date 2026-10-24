import "dotenv/config";
import { prisma } from "../src/lib/prisma.ts";
import { seedCaseData } from "./seed-case-data.ts";

try {
  await seedCaseData(prisma);
} finally {
  await prisma.$disconnect();
}
