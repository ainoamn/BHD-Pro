export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  companyId: string;
  /** Resolved module access matrix (view/edit/hidden) */
  modulePermissions?: Record<string, 'hidden' | 'view' | 'edit'>;
  apiKeyScopes?: string[];
}
