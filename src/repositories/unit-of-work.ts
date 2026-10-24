import type { CompanyRepository } from "./company.repository.ts";
import type { OpportunityRepository } from "./opportunity.repository.ts";
import type { UserRepository } from "./user.repository.ts";

export type Repositories = {
  opportunities: OpportunityRepository;
  companies: CompanyRepository;
  users: UserRepository;
};

export interface UnitOfWork {
  run<T>(work: (repositories: Repositories) => Promise<T>): Promise<T>;
}
