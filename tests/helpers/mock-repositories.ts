import { vi, type Mocked } from "vitest";
import type { Opportunity } from "../../src/generated/prisma/client.ts";
import type { CompanyRepository } from "../../src/repositories/company.repository.ts";
import type { OpportunityRepository } from "../../src/repositories/opportunity.repository.ts";
import type { UnitOfWork } from "../../src/repositories/unit-of-work.ts";
import type { UserRepository } from "../../src/repositories/user.repository.ts";
import type { OpportunityDetailRow } from "../../src/types/opportunity-rows.types.ts";
import type { CurrentUser } from "../../src/types/user.types.ts";

export function mockRepositories() {
  const opportunities: Mocked<OpportunityRepository> = {
    findVisible: vi.fn(),
    findVisibleCards: vi.fn(),
    findDetail: vi.fn(),
    countItems: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    replaceItems: vi.fn(),
    changeStage: vi.fn(),
    recordFollowUp: vi.fn(),
    recordSnooze: vi.fn(),
    addComment: vi.fn(),
  };
  const companies: Mocked<CompanyRepository> = { findOrCreate: vi.fn() };
  const users: Mocked<UserRepository> = {
    findById: vi.fn(),
    list: vi.fn(),
    isTeamMember: vi.fn(),
  };
  const repositories = { opportunities, companies, users };
  const unitOfWork: UnitOfWork = { run: (work) => work(repositories) };

  return { ...repositories, unitOfWork };
}

export const seller: CurrentUser = {
  id: 10,
  name: "Ana",
  role: "SELLER",
  managerId: 1,
};

export const manager: CurrentUser = {
  id: 1,
  name: "Marcos",
  role: "MANAGER",
  managerId: null,
};

export function opportunityRow(overrides: Partial<Opportunity> = {}) {
  const at = new Date("2026-10-14T12:00:00-03:00");
  return {
    id: 7,
    contactName: "João",
    contactPhone: null,
    contactEmail: null,
    estimatedValue: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    snoozedUntil: null,
    snoozeCount: 0,
    proposalValidUntil: null,
    eventDate: null,
    stage: "FIRST_CONTACT",
    stageEnteredAt: at,
    lossReason: null,
    lossDetail: null,
    createdAt: at,
    updatedAt: at,
    companyId: 3,
    ownerId: seller.id,
    ...overrides,
  } satisfies Opportunity;
}

export function detailRow(
  overrides: Partial<Opportunity> = {},
): OpportunityDetailRow {
  return {
    ...opportunityRow(overrides),
    company: { id: 3, name: "Acme" },
    owner: { id: seller.id, name: seller.name },
    items: [],
    stageChanges: [],
    followUps: [],
    snoozes: [],
    comments: [],
  };
}
