export type UserRole = "SELLER" | "MANAGER";

export type CurrentUser = {
  id: number;
  name: string;
  role: UserRole;
  managerId: number | null;
};
