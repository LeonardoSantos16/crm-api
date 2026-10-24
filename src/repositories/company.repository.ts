import type { CompanyRef } from "../types/company.types.ts";

export interface CompanyRepository {
  findOrCreate(name: string): Promise<CompanyRef>;
}
