export type OrganizationRole = "OWNER" | "ADMIN" | "USER";

export type TenantContext = Readonly<{
  organizationId: string;
  userId: string;
  role: OrganizationRole;
}>;

export class AuthorizationError extends Error {
  readonly name = "AuthorizationError";
}

const roleWeight: Record<OrganizationRole, number> = { USER: 1, ADMIN: 2, OWNER: 3 };

export function requireRole(context: TenantContext, minimum: OrganizationRole): TenantContext {
  if (roleWeight[context.role] < roleWeight[minimum]) {
    throw new AuthorizationError(`Role ${context.role} cannot perform an action requiring ${minimum}`);
  }
  return context;
}

export function assertBelongsToTenant(context: TenantContext, record: { organizationId: string }): void {
  if (record.organizationId !== context.organizationId) {
    throw new AuthorizationError("Cross-organization access denied");
  }
}
