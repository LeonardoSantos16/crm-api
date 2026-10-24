import "dotenv/config";
import type { OpportunityStage } from "../src/generated/prisma/client.ts";
import { prisma } from "../src/lib/prisma.ts";

// Dados fictícios do case (data de referência: 15/10/2026).
const contactAt = (date: string) => new Date(`${date}T12:00:00-03:00`);
const calendarDate = (date: string) => new Date(`${date}T00:00:00Z`);

const opportunities: {
  id: number;
  company: string;
  gift: string;
  quantity: number;
  estimatedValue: string;
  owner: string;
  lastContact: string;
  proposalValidUntil?: string;
  eventDate: string;
  stage: OpportunityStage;
  lossReason?: string;
}[] = [
  {
    id: 2001,
    company: "Tech Alpha Ltda",
    gift: "Caneca personalizada",
    quantity: 300,
    estimatedValue: "4500",
    owner: "Ana",
    lastContact: "2026-10-14",
    eventDate: "2026-11-30",
    stage: "FIRST_CONTACT",
  },
  {
    id: 2002,
    company: "Construtora Horizonte",
    gift: "Kit escritório",
    quantity: 120,
    estimatedValue: "9800",
    owner: "Bruno",
    lastContact: "2026-10-06",
    proposalValidUntil: "2026-10-13",
    eventDate: "2026-10-25",
    stage: "BUDGET_PRESENTATION",
  },
  {
    id: 2003,
    company: "Clínica Vida",
    gift: "Squeeze personalizado",
    quantity: 500,
    estimatedValue: "7200",
    owner: "Ana",
    lastContact: "2026-10-13",
    proposalValidUntil: "2026-10-20",
    eventDate: "2026-10-18",
    stage: "FOLLOW_UP",
  },
  {
    id: 2004,
    company: "Agência Pulso",
    gift: "Camiseta estampada",
    quantity: 80,
    estimatedValue: "3900",
    owner: "Carla",
    lastContact: "2026-10-02",
    proposalValidUntil: "2026-10-10",
    eventDate: "2026-11-05",
    stage: "FOLLOW_UP",
  },
  {
    id: 2005,
    company: "Banco Norte",
    gift: "Agenda executiva",
    quantity: 1000,
    estimatedValue: "38000",
    owner: "Bruno",
    lastContact: "2026-10-15",
    proposalValidUntil: "2026-10-22",
    eventDate: "2026-12-12",
    stage: "FORECAST",
  },
  {
    id: 2006,
    company: "Escola Saber",
    gift: "Mochila infantil",
    quantity: 250,
    estimatedValue: "11500",
    owner: "Carla",
    lastContact: "2026-10-09",
    proposalValidUntil: "2026-10-16",
    eventDate: "2026-10-17",
    stage: "CLOSING",
  },
  {
    id: 2007,
    company: "Padaria do Bairro",
    gift: "Caneta promocional",
    quantity: 50,
    estimatedValue: "350",
    owner: "Ana",
    lastContact: "2026-10-01",
    proposalValidUntil: "2026-10-08",
    eventDate: "2026-10-20",
    stage: "LOST",
    lossReason: "Não informado (dado legado)",
  },
];

async function main() {
  await prisma.$transaction(async (tx) => {
    await tx.stageChange.deleteMany();
    await tx.opportunityItem.deleteMany();
    await tx.opportunity.deleteMany();
    await tx.company.deleteMany();
    await tx.user.deleteMany();

    const manager = await tx.user.create({
      data: { name: "Gestor Comercial", role: "MANAGER" },
    });
    const sellers = new Map<string, number>();
    for (const name of ["Ana", "Bruno", "Carla"]) {
      const seller = await tx.user.create({
        data: { name, managerId: manager.id },
      });
      sellers.set(name, seller.id);
    }

    for (const opp of opportunities) {
      const stageEnteredAt = contactAt(opp.lastContact);
      const company = await tx.company.upsert({
        where: { name: opp.company },
        create: { name: opp.company },
        update: {},
      });
      await tx.opportunity.create({
        data: {
          id: opp.id,
          estimatedValue: opp.estimatedValue,
          lastContactAt: contactAt(opp.lastContact),
          proposalValidUntil: opp.proposalValidUntil
            ? calendarDate(opp.proposalValidUntil)
            : null,
          eventDate: calendarDate(opp.eventDate),
          stage: opp.stage,
          stageEnteredAt,
          lossReason: opp.lossReason ?? null,
          companyId: company.id,
          ownerId: sellers.get(opp.owner)!,
          items: { create: { description: opp.gift, quantity: opp.quantity } },
          stageChanges: {
            create: {
              fromStage: null,
              toStage: opp.stage,
              changedAt: stageEnteredAt,
            },
          },
        },
      });
    }

    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('"Opportunity"', 'id'), (SELECT MAX(id) FROM "Opportunity"))`;
  });
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
