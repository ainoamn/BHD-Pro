import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';

export type DualApprovalPayload = {
  method: 'SELF_CONFIRM' | 'PASSWORD' | 'PIN' | 'APPROVAL_REQUEST' | 'WHATSAPP_OTP' | 'NFC';
  email?: string;
  password?: string;
  pin?: string;
  approvalRequestId?: string;
  otp?: string;
  badgeSecret?: string;
  /** Required by server when dual-control is enforced (min 3 chars) */
  reason?: string;
};

export type RestoOrderPayload = {
  id: string;
  number: string;
  status: string;
  channel?: string;
  guests: number;
  notes: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryStatus?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  deliveredAt?: string | null;
  invoiceId?: string | null;
  openedById?: string | null;
  tipAssigneeId?: string | null;
  contactId?: string | null;
  openedBy?: { id: string; name: string; email: string } | null;
  tipAssignee?: { id: string; name: string; email: string } | null;
  externalChannel?: string | null;
  externalOrderId?: string | null;
  loyalty?: {
    contactId: string;
    name: string;
    phone: string | null;
    points: number;
  } | null;
  sentAt: string | null;
  closedAt: string | null;
  createdAt: string;
  table: {
    id: string;
    code: string;
    name: string | null;
    zoneId?: string | null;
  } | null;
  items: Array<{
    id: string;
    productId: string | null;
    name: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    notes: string | null;
    course?: number;
    seat?: number | null;
    isComp?: boolean;
    voidReason?: string | null;
    source?: string;
    status: string;
  }>;
  bySeat?: Array<{
    seat: number | null;
    subtotal: number;
    itemIds: string[];
  }>;
  subtotal: number;
  itemCount: number;
  invoice?: { id: string } | null;
};

/** Prefer same-origin Next rewrite so httpOnly cookies work on localhost + production */
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? '/backend-api' : 'http://localhost:3001/api');

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 60000,
      withCredentials: true,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.request.use(
      (config) => {
        const { accessToken, company } = useAuthStore.getState();

        // Optional Bearer (memory) — cookies are primary for browser sessions
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        if (company?.id) {
          config.headers['X-Company-ID'] = company.id;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
        const url = originalRequest?.url || '';
        const skipRefresh =
          url.includes('/auth/login') ||
          url.includes('/auth/register') ||
          url.includes('/auth/google') ||
          url.includes('/auth/refresh') ||
          url.includes('/auth/logout');

        if (error.response?.status === 401 && !originalRequest._retry && !skipRefresh) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshAccessToken();
            originalRequest.headers = originalRequest.headers || {};
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return this.client(originalRequest);
          } catch (refreshError) {
            if (typeof window !== 'undefined') {
              const path = window.location.pathname || '';
              const isAuthSurface =
                path.startsWith('/login') ||
                path.startsWith('/register') ||
                path.startsWith('/pay') ||
                path.startsWith('/share');
              const memoryToken = useAuthStore.getState().accessToken;

              // A login may have completed while this 401 probe was in flight.
              // Prefer the fresh Bearer token over wiping the new session.
              if (memoryToken) {
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${memoryToken}`;
                return this.client(originalRequest);
              }

              useAuthStore.getState().logout();
              if (!isAuthSurface) {
                const here = `${path}${window.location.search || ''}`;
                window.location.href = `/login?next=${encodeURIComponent(here)}`;
              }
            } else {
              useAuthStore.getState().logout();
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.client
      .post('/auth/refresh', {})
      .then((response) => {
        const { accessToken } = response.data as { accessToken?: string };
        if (accessToken) {
          useAuthStore.getState().setAccessToken(accessToken);
        }
        return accessToken || null;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    const data = response.data as {
      requires2fa?: boolean;
      tempToken?: string;
      user?: { company?: unknown; companyId?: string; id: string; name: string; email: string; role: string };
      accessToken?: string;
    };
    if (data.requires2fa) {
      return data;
    }
    const user = data.user!;
    const company = user.company as import('@/types').Company;
    const { company: _c, ...userWithoutCompany } = user;
    useAuthStore.getState().login(
      {
        ...userWithoutCompany,
        companyId: company?.id || user.companyId || '',
        role: user.role as import('@/types').User['role'],
        company,
      },
      company,
      data.accessToken || null
    );
    return data;
  }

  async verify2faLogin(tempToken: string, code: string) {
    const response = await this.client.post('/auth/2fa/verify-login', { tempToken, code });
    const { user, accessToken } = response.data;
    const company = user.company as import('@/types').Company;
    useAuthStore.getState().login(
      {
        ...user,
        companyId: company?.id || user.companyId,
        company,
      },
      company,
      accessToken || null
    );
    return response.data;
  }

  get2faStatus() {
    return this.get<{ enabled: boolean }>('/auth/2fa/status');
  }

  setup2fa() {
    return this.post<{ otpauthUrl: string; qrCodeDataUrl: string; secret: string }>('/auth/2fa/setup');
  }

  confirm2fa(code: string) {
    return this.post('/auth/2fa/confirm', { code });
  }

  disable2fa(password: string, code: string) {
    return this.post('/auth/2fa/disable', { password, code });
  }

  async register(data: { name: string; email: string; password: string; companyName: string; plan?: string }) {
    const response = await this.client.post('/auth/register', data);
    const { user, accessToken } = response.data;
    const company = user.company;
    useAuthStore.getState().login(
      { ...user, companyId: company?.id || user.companyId },
      company,
      accessToken || null
    );
    return response.data;
  }

  async googleLogin(idToken: string, companyName?: string) {
    const response = await this.client.post('/auth/google', {
      idToken,
      ...(companyName ? { companyName } : {}),
    });
    const data = response.data as {
      requires2fa?: boolean;
      tempToken?: string;
      user?: { company?: unknown; companyId?: string; id: string; name: string; email: string; role: string };
      accessToken?: string;
    };
    if (data.requires2fa) {
      return data;
    }
    const user = data.user!;
    const company = user.company as import('@/types').Company;
    const { company: _c, ...userWithoutCompany } = user;
    useAuthStore.getState().login(
      {
        ...userWithoutCompany,
        companyId: company?.id || user.companyId || '',
        role: user.role as import('@/types').User['role'],
        company,
      },
      company,
      data.accessToken || null
    );
    return data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout', {});
    } catch {
      // clear local state even if API fails
    }
    useAuthStore.getState().logout();
  }

  async getMe() {
    return this.get('/auth/me');
  }

  async restoreSession() {
    try {
      const res = await this.getMe();
      const data = res.data as {
        id: string;
        name: string;
        email: string;
        role: string;
        companyId: string;
        company: import('@/types').Company;
        permissions?: Record<string, 'hidden' | 'view' | 'edit'> | null;
        modulePermissions?: Record<string, 'hidden' | 'view' | 'edit'>;
      };
      // Keep any in-memory accessToken from a just-completed login.
      const existingToken = useAuthStore.getState().accessToken;
      useAuthStore.getState().login(
        {
          id: data.id,
          name: data.name,
          email: data.email,
          role: data.role as never,
          companyId: data.companyId,
          permissions: data.permissions,
          modulePermissions: data.modulePermissions,
        },
        data.company,
        existingToken
      );
      return true;
    } catch {
      // Do NOT logout here — a slow/failed probe on /login must not wipe a
      // login that succeeded while this request was still in flight.
      return false;
    }
  }

  // Generic HTTP methods
  get<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.get<T>(url, config);
  }

  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.post<T>(url, data, config);
  }

  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.put<T>(url, data, config);
  }

  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    return this.client.patch<T>(url, data, config);
  }

  delete<T>(url: string, config?: AxiosRequestConfig) {
    return this.client.delete<T>(url, config);
  }

  // Invoices
  getInvoices(params?: {
    isCash?: boolean;
    type?: string;
    status?: string;
    paymentStatus?: string;
    q?: string;
  }) {
    return this.get('/invoices', {
      params: {
        ...(params?.isCash != null ? { isCash: String(params.isCash) } : {}),
        ...(params?.type ? { type: params.type } : {}),
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.paymentStatus ? { paymentStatus: params.paymentStatus } : {}),
        ...(params?.q ? { q: params.q } : {}),
      },
    });
  }

  getInvoiceStats(type?: string) {
    return this.get('/invoices/stats', { params: type ? { type } : {} });
  }

  getInvoice(id: string) {
    return this.get(`/invoices/${id}`);
  }

  createDocumentShareLink(id: string, variant: "invoice" | "receipt" = "invoice") {
    return this.post<{
      token: string;
      shareUrl: string;
      sharePath?: string;
      expiresInDays: number;
    }>(`/invoices/${id}/share-link`, { variant });
  }

  createDocumentVerifyLink(id: string, variant: "invoice" | "receipt" = "invoice") {
    return this.post<{
      token: string;
      code?: string;
      verifyUrl: string;
      verifyPath?: string;
      appVerifyPath?: string;
      documentNumber: string;
    }>(`/invoices/${id}/verify-link`, { variant });
  }

  getPublicDocument(token: string) {
    return this.client.get(`/public/documents/${token}`);
  }

  createInvoice(data: unknown) {
    return this.post('/invoices', data);
  }

  updateInvoice(id: string, data: unknown) {
    return this.put(`/invoices/${id}`, data);
  }

  deleteInvoice(id: string) {
    return this.delete(`/invoices/${id}`);
  }

  updateInvoiceStatus(id: string, status: string, approval?: DualApprovalPayload) {
    return this.patch(`/invoices/${id}/status`, {
      status,
      ...(approval ? { approval } : {}),
    });
  }

  sendInvoice(id: string, email?: string) {
    return this.post(`/invoices/${id}/send`, email ? { email } : {});
  }

  recordInvoicePayment(id: string, data: unknown) {
    return this.post(`/invoices/${id}/payments`, data);
  }

  recordBatchInvoicePayment(data: {
    method: string;
    date?: string;
    reference?: string;
    notes?: string;
    bankAccountId?: string;
    allocations: { invoiceId: string; amount: number }[];
  }) {
    return this.post('/invoices/payments/batch', data);
  }

  unsendInvoice(id: string) {
    return this.post(`/invoices/${id}/unsend`);
  }

  reverseInvoicePayment(invoiceId: string, paymentId: string) {
    return this.delete(`/invoices/${invoiceId}/payments/${paymentId}`);
  }

  reverseAllInvoicePayments(invoiceId: string, approval?: DualApprovalPayload) {
    return this.post(
      `/invoices/${invoiceId}/payments/reverse-all`,
      approval ? { approval } : {},
    );
  }

  // Contacts
  getContacts(type?: string, q?: string) {
    return this.get('/contacts', {
      params: {
        ...(type ? { type } : {}),
        ...(q?.trim() ? { q: q.trim() } : {}),
      },
    });
  }

  createContact(data: unknown) {
    return this.post('/contacts', data);
  }

  adjustContactStoreCredit(
    id: string,
    data: { amount: number; notes?: string; bankAccountId?: string },
  ) {
    return this.post(`/contacts/${id}/store-credit-adjust`, data);
  }

  // Subscriptions
  getSubscriptionPlans() {
    return this.get('/subscriptions/plans');
  }

  getCurrentSubscription() {
    return this.get('/subscriptions/current');
  }

  upgradeSubscription(plan: string, billing: 'monthly' | 'yearly') {
    return this.post('/subscriptions/upgrade', { plan, billing });
  }

  getPlatformGateways() {
    return this.get('/payments/platform-gateways');
  }

  // Platform admin (requires PLATFORM_ADMIN_EMAILS)
  getAdminMe() {
    return this.get<{ isPlatformAdmin: boolean; email: string }>('/admin/me');
  }

  getAdminOverview() {
    return this.get('/admin/overview');
  }

  getAdminTenants(params?: { q?: string; plan?: string; active?: string }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.plan) qs.set('plan', params.plan);
    if (params?.active) qs.set('active', params.active);
    const q = qs.toString();
    return this.get(`/admin/tenants${q ? `?${q}` : ''}`);
  }

  getAdminTenant(id: string) {
    return this.get(`/admin/tenants/${id}`);
  }

  updateAdminTenant(id: string, data: unknown) {
    return this.patch(`/admin/tenants/${id}`, data);
  }

  getAdminUsers(q?: string) {
    return this.get(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }

  getAdminUser(id: string) {
    return this.get(`/admin/users/${id}`);
  }

  updateAdminUser(id: string, data: { isActive: boolean }) {
    return this.patch(`/admin/users/${id}`, data);
  }

  getAdminBilling(status?: string) {
    return this.get(`/admin/billing${status ? `?status=${status}` : ''}`);
  }

  getAdminOffers() {
    return this.get('/admin/offers');
  }

  createAdminOffer(data: unknown) {
    return this.post('/admin/offers', data);
  }

  updateAdminOffer(id: string, data: unknown) {
    return this.patch(`/admin/offers/${id}`, data);
  }

  deleteAdminOffer(id: string) {
    return this.delete(`/admin/offers/${id}`);
  }

  getAdminPlans() {
    return this.get('/admin/plans');
  }

  createAdminPlan(data: unknown) {
    return this.post('/admin/plans', data);
  }

  updateAdminPlan(code: string, data: unknown) {
    return this.patch(`/admin/plans/${encodeURIComponent(code)}`, data);
  }

  deleteAdminPlan(code: string) {
    return this.delete(`/admin/plans/${encodeURIComponent(code)}`);
  }

  getAdminVisits(limit?: number) {
    return this.get(`/admin/visits${limit ? `?limit=${limit}` : ''}`);
  }

  getAdminSessions(limit?: number) {
    return this.get(`/admin/sessions${limit ? `?limit=${limit}` : ''}`);
  }

  getAdminSettings() {
    return this.get('/admin/settings');
  }

  updateAdminSetting(key: string, value: unknown) {
    return this.patch(`/admin/settings/${encodeURIComponent(key)}`, { value });
  }

  getAdminPaymentGateways() {
    return this.get('/admin/payment-gateways');
  }

  getAdminPaymentGateway(slug: string) {
    return this.get(`/admin/payment-gateways/${encodeURIComponent(slug)}`);
  }

  updateAdminPaymentGateway(slug: string, data: unknown) {
    return this.patch(`/admin/payment-gateways/${slug}`, data);
  }

  getAdminOperators() {
    return this.get('/admin/operators');
  }

  appointAdminOperator(data: { email: string; name?: string; permissions?: string[] }) {
    return this.post('/admin/operators', data);
  }

  updateAdminOperator(
    id: string,
    data: { name?: string; permissions?: string[]; isActive?: boolean },
  ) {
    return this.patch(`/admin/operators/${id}`, data);
  }

  removeAdminOperator(id: string) {
    return this.delete(`/admin/operators/${id}`);
  }

  trackSiteVisit(data: { path: string; referrer?: string; country?: string; city?: string }) {
    return this.client.post('/public/visits', data);
  }

  getPublicPlatformStats() {
    return this.client.get<{
      companies: number;
      users: number;
      visits: {
        total: number;
        last30Days: number;
        uniqueTotal: number;
        uniqueLast30Days: number;
      };
      finance: {
        sales: number;
        purchases: number;
        collected: number;
        receivables: number;
        volumeManaged: number;
        currency: "OMR";
      };
      growth: {
        companies: number | null;
        users: number | null;
        visits: number | null;
        volume: number | null;
      };
      updatedAt: string;
    }>('/public/stats');
  }

  getPublicCustomerLogos() {
    return this.client.get<{
      companies: { id: string; name: string; logo: string }[];
      updatedAt: string;
    }>('/public/customer-logos');
  }

  getCompanyGateways() {
    return this.get('/payments/company-gateways');
  }

  updateCompanyGateway(slug: string, data: unknown) {
    return this.patch(`/payments/company-gateways/${slug}`, data);
  }

  createSubscriptionCheckout(data: unknown) {
    return this.post('/payments/subscription/checkout', data);
  }

  validateSubscriptionPromo(plan: string, billing: string, code: string) {
    const q = new URLSearchParams({ plan, billing, code });
    return this.get(`/payments/subscription/promo?${q.toString()}`);
  }

  createInvoiceCheckout(invoiceId: string, data: unknown) {
    return this.post(`/payments/invoices/${invoiceId}/checkout`, data);
  }

  getPublicInvoicePayInfo(invoiceId: string) {
    return this.get(`/payments/public/invoice/${invoiceId}`);
  }

  createPublicInvoiceCheckout(invoiceId: string, data: unknown) {
    return this.post(`/payments/public/invoice/${invoiceId}/checkout`, data);
  }

  getBillingInvoice(number: string) {
    return this.get(`/payments/billing/${number}`);
  }

  // Dashboard
  getDashboardStats() {
    return this.get('/dashboard/stats');
  }

  // Journal
  getJournals() {
    return this.get('/journal');
  }

  getJournalAccounts() {
    return this.get('/journal/accounts');
  }

  createJournal(data: unknown) {
    return this.post('/journal', data);
  }

  deleteJournal(id: string) {
    return this.delete(`/journal/${id}`);
  }

  // Products
  getProducts() {
    return this.get('/products');
  }

  getProductStats() {
    return this.get('/products/stats');
  }

  getNextProductCodes() {
    return this.get<{
      sku: string;
      barcode: string;
      barcodeFormat: string;
      noteAr: string;
      noteEn: string;
    }>('/products/next-codes');
  }

  createProduct(data: unknown) {
    return this.post('/products', data);
  }

  updateProduct(id: string, data: unknown) {
    return this.put(`/products/${id}`, data);
  }

  deleteProduct(id: string) {
    return this.delete(`/products/${id}`);
  }

  adjustProductStock(id: string, data: unknown) {
    return this.post(`/products/${id}/adjust`, data);
  }

  transferProductStock(id: string, data: unknown) {
    return this.post(`/products/${id}/transfer`, data);
  }

  getProductMovements(id: string) {
    return this.get(`/products/${id}/movements`);
  }

  updateContact(id: string, data: unknown) {
    return this.put(`/contacts/${id}`, data);
  }

  deleteContact(id: string) {
    return this.delete(`/contacts/${id}`);
  }

  // Chart of Accounts
  getAccounts() {
    return this.get('/accounts');
  }
  getAccountsTree() {
    return this.get('/accounts/tree');
  }
  createAccount(data: unknown) {
    return this.post('/accounts', data);
  }
  updateAccount(id: string, data: unknown) {
    return this.put(`/accounts/${id}`, data);
  }
  deleteAccount(id: string) {
    return this.delete(`/accounts/${id}`);
  }

  // ERP modules
  getBranches() {
    return this.get('/branches');
  }
  createBranch(data: unknown) {
    return this.post('/branches', data);
  }
  updateBranch(id: string, data: unknown) {
    return this.put(`/branches/${id}`, data);
  }
  deleteBranch(id: string) {
    return this.delete(`/branches/${id}`);
  }

  getWarehouses() {
    return this.get('/warehouses');
  }
  createWarehouse(data: unknown) {
    return this.post('/warehouses', data);
  }
  updateWarehouse(id: string, data: unknown) {
    return this.put(`/warehouses/${id}`, data);
  }
  deleteWarehouse(id: string) {
    return this.delete(`/warehouses/${id}`);
  }

  seedDefaultAnalytics() {
    return this.post('/cost-centers/seed-defaults');
  }

  getCostCenters() {
    return this.get('/cost-centers');
  }
  createCostCenter(data: unknown) {
    return this.post('/cost-centers', data);
  }
  updateCostCenter(id: string, data: unknown) {
    return this.put(`/cost-centers/${id}`, data);
  }
  deleteCostCenter(id: string) {
    return this.delete(`/cost-centers/${id}`);
  }

  getProjects() {
    return this.get('/projects');
  }
  createProject(data: unknown) {
    return this.post('/projects', data);
  }
  updateProject(id: string, data: unknown) {
    return this.put(`/projects/${id}`, data);
  }
  deleteProject(id: string) {
    return this.delete(`/projects/${id}`);
  }

  getEmployees() {
    return this.get('/employees');
  }
  createEmployee(data: unknown) {
    return this.post('/employees', data);
  }
  updateEmployee(id: string, data: unknown) {
    return this.put(`/employees/${id}`, data);
  }
  deleteEmployee(id: string) {
    return this.delete(`/employees/${id}`);
  }

  getAssets() {
    return this.get('/assets');
  }
  createAsset(data: unknown) {
    return this.post('/assets', data);
  }
  updateAsset(id: string, data: unknown) {
    return this.put(`/assets/${id}`, data);
  }
  deleteAsset(id: string) {
    return this.delete(`/assets/${id}`);
  }
  depreciateAsset(id: string) {
    return this.post(`/assets/${id}/depreciate`);
  }

  getBankAccounts() {
    return this.get('/bank-accounts');
  }
  createBankAccount(data: unknown) {
    return this.post('/bank-accounts', data);
  }
  updateBankAccount(id: string, data: unknown) {
    return this.put(`/bank-accounts/${id}`, data);
  }
  deleteBankAccount(id: string) {
    return this.delete(`/bank-accounts/${id}`);
  }

  getBankStatementLines(bankAccountId: string) {
    return this.get(`/bank-accounts/${bankAccountId}/statement-lines`);
  }

  addBankStatementLine(bankAccountId: string, data: unknown) {
    return this.post(`/bank-accounts/${bankAccountId}/statement-lines`, data);
  }

  getBankReconciliation(bankAccountId: string) {
    return this.get(`/bank-accounts/${bankAccountId}/reconciliation`);
  }

  toggleBankStatementReconciled(lineId: string) {
    return this.post(`/bank-accounts/statement-lines/${lineId}/toggle-reconciled`);
  }

  deleteBankStatementLine(lineId: string) {
    return this.delete(`/bank-accounts/statement-lines/${lineId}`);
  }

  transferBetweenBanks(data: {
    fromBankAccountId: string;
    toBankAccountId: string;
    amount: number;
    date?: string;
    description?: string;
    reference?: string;
    approval?: DualApprovalPayload;
  }) {
    return this.post('/bank-accounts/transfer', data);
  }

  suggestBankStatementMatches(bankAccountId: string, days?: number) {
    return this.get(`/bank-accounts/${bankAccountId}/suggest-matches`, {
      params: days ? { days } : {},
    });
  }

  getPayrollRuns() {
    return this.get('/payroll');
  }
  createPayrollRun(data: unknown) {
    return this.post('/payroll', data);
  }
  updatePayrollStatus(
    id: string,
    status: string,
    opts?: {
      bankAccountId?: string;
      paymentMethod?: string;
      approval?: DualApprovalPayload;
    },
  ) {
    return this.patch(`/payroll/${id}/status`, { status, ...opts });
  }
  deletePayrollRun(id: string) {
    return this.delete(`/payroll/${id}`);
  }

  // Reports
  getProfitLoss() {
    return this.get('/reports/profit-loss');
  }

  getBalanceSheet() {
    return this.get('/reports/balance-sheet');
  }

  getTrialBalance() {
    return this.get('/reports/trial-balance');
  }

  getCashFlowReport() {
    return this.get('/reports/cash-flow');
  }

  getCashFlowForecast(weeks?: number) {
    return this.get('/reports/cash-flow-forecast', {
      params: weeks ? { weeks } : {},
    });
  }

  getAuditLog(params?: { limit?: number; entity?: string; action?: string }) {
    return this.get('/reports/audit-log', { params: params || {} });
  }

  getTaxRates() {
    return this.get('/tax-rates');
  }

  createTaxRate(data: unknown) {
    return this.post('/tax-rates', data);
  }

  updateTaxRate(id: string, data: unknown) {
    return this.put(`/tax-rates/${id}`, data);
  }

  deleteTaxRate(id: string) {
    return this.delete(`/tax-rates/${id}`);
  }

  setDefaultTaxRate(id: string) {
    return this.post(`/tax-rates/${id}/set-default`);
  }

  getApiKeys() {
    return this.get('/api-keys');
  }

  createApiKey(data: { name: string }) {
    return this.post('/api-keys', data);
  }

  updateApiKey(id: string, data: { name: string }) {
    return this.put(`/api-keys/${id}`, data);
  }

  revokeApiKey(id: string) {
    return this.post(`/api-keys/${id}/revoke`);
  }

  deleteApiKey(id: string) {
    return this.delete(`/api-keys/${id}`);
  }

  getEmployeeClaims() {
    return this.get('/employee-claims');
  }

  createEmployeeClaim(data: unknown) {
    return this.post('/employee-claims', data);
  }

  updateEmployeeClaim(id: string, data: unknown) {
    return this.put(`/employee-claims/${id}`, data);
  }

  submitEmployeeClaim(id: string) {
    return this.post(`/employee-claims/${id}/submit`);
  }

  approveEmployeeClaim(id: string) {
    return this.post(`/employee-claims/${id}/approve`);
  }

  rejectEmployeeClaim(id: string, data?: { reason?: string }) {
    return this.post(`/employee-claims/${id}/reject`, data || {});
  }

  payEmployeeClaim(
    id: string,
    data?: {
      paymentMethod?: string;
      bankAccountId?: string;
      approval?: DualApprovalPayload;
    },
  ) {
    return this.post(`/employee-claims/${id}/pay`, data || {});
  }

  deleteEmployeeClaim(id: string) {
    return this.delete(`/employee-claims/${id}`);
  }

  getCommitments() {
    return this.get('/commitments');
  }
  createCommitment(data: unknown) {
    return this.post('/commitments', data);
  }
  updateCommitment(id: string, data: unknown) {
    return this.put(`/commitments/${id}`, data);
  }
  pauseCommitment(id: string, data?: unknown) {
    return this.post(`/commitments/${id}/pause`, data || {});
  }
  resumeCommitment(id: string) {
    return this.post(`/commitments/${id}/resume`);
  }
  runDueCommitments() {
    return this.post('/commitments/run-due');
  }
  deleteCommitment(id: string) {
    return this.delete(`/commitments/${id}`);
  }

  getAttachments(entityType: string, entityId: string) {
    return this.get('/attachments', { params: { entityType, entityId } });
  }
  createAttachment(data: unknown) {
    return this.post('/attachments', data);
  }
  deleteAttachment(id: string) {
    return this.delete(`/attachments/${id}`);
  }

  getManagementAlerts(status?: string) {
    return this.get('/management-alerts', { params: status ? { status } : {} });
  }
  resolveManagementAlert(id: string, status = 'RESOLVED') {
    return this.patch(`/management-alerts/${id}`, { status });
  }

  getDocumentTemplates(type?: string) {
    return this.get('/document-templates', { params: type ? { type } : {} });
  }

  getDefaultDocumentTemplate(type: string) {
    return this.get('/document-templates/default', { params: { type } });
  }

  createDocumentTemplate(data: unknown) {
    return this.post('/document-templates', data);
  }

  updateDocumentTemplate(id: string, data: unknown) {
    return this.put(`/document-templates/${id}`, data);
  }

  setDefaultDocumentTemplate(id: string) {
    return this.post(`/document-templates/${id}/set-default`);
  }

  deleteDocumentTemplate(id: string) {
    return this.delete(`/document-templates/${id}`);
  }

  getCustomFields(entityType?: string) {
    return this.get('/custom-fields', {
      params: entityType ? { entityType } : {},
    });
  }

  createCustomField(data: unknown) {
    return this.post('/custom-fields', data);
  }

  updateCustomField(id: string, data: unknown) {
    return this.put(`/custom-fields/${id}`, data);
  }

  deleteCustomField(id: string) {
    return this.delete(`/custom-fields/${id}`);
  }

  getExchangeRates() {
    return this.get('/exchange-rates');
  }

  createExchangeRate(data: unknown) {
    return this.post('/exchange-rates', data);
  }

  updateExchangeRate(id: string, data: unknown) {
    return this.put(`/exchange-rates/${id}`, data);
  }

  deleteExchangeRate(id: string) {
    return this.delete(`/exchange-rates/${id}`);
  }

  convertExchangeRate(params: { from: string; to: string; amount: number; date?: string }) {
    return this.get('/exchange-rates/convert', { params });
  }

  previewFxRevaluation(asOf?: string) {
    return this.get('/fx-revaluation/preview', { params: asOf ? { asOf } : {} });
  }

  postFxRevaluation(data: { asOf: string; invoiceIds?: string[] }) {
    return this.post('/fx-revaluation/post', data);
  }

  getDeliveryNotes() {
    return this.get('/delivery-notes');
  }

  createDeliveryNote(data: unknown) {
    return this.post('/delivery-notes', data);
  }

  deliverDeliveryNote(id: string) {
    return this.post(`/delivery-notes/${id}/deliver`);
  }

  cancelDeliveryNote(id: string) {
    return this.post(`/delivery-notes/${id}/cancel`);
  }

  deleteDeliveryNote(id: string) {
    return this.delete(`/delivery-notes/${id}`);
  }

  getStockCounts() {
    return this.get('/stock-counts');
  }

  getStockCount(id: string) {
    return this.get(`/stock-counts/${id}`);
  }

  createStockCount(data: unknown) {
    return this.post('/stock-counts', data);
  }

  updateStockCountLines(id: string, data: { lines: { productId: string; countedQty: number }[] }) {
    return this.put(`/stock-counts/${id}/lines`, data);
  }

  completeStockCount(id: string) {
    return this.post(`/stock-counts/${id}/complete`);
  }

  cancelStockCount(id: string) {
    return this.post(`/stock-counts/${id}/cancel`);
  }

  deleteStockCount(id: string) {
    return this.delete(`/stock-counts/${id}`);
  }

  getArAging() {
    return this.get('/reports/ar-aging');
  }

  getApAging() {
    return this.get('/reports/ap-aging');
  }

  getContactStatement(contactId: string) {
    return this.get('/reports/contact-statement', { params: { contactId } });
  }

  getSalesSummary() {
    return this.get('/reports/sales-summary');
  }

  getPurchaseSummary() {
    return this.get('/reports/purchase-summary');
  }

  getVatSummary() {
    return this.get('/reports/vat-summary');
  }

  getGeneralLedger(accountId?: string) {
    return this.get('/reports/general-ledger', { params: accountId ? { accountId } : {} });
  }

  getInventorySummary() {
    return this.get('/reports/inventory-summary');
  }

  getPayrollSummary() {
    return this.get('/reports/payroll-summary');
  }

  getCostCenterProfitLoss() {
    return this.get('/reports/cost-center-pl');
  }

  getProjectBudgetReport() {
    return this.get('/reports/project-budget');
  }

  getPaymentVouchers(type?: 'SALES' | 'PURCHASE') {
    return this.get('/invoices/payments/list', { params: type ? { type } : {} });
  }

  convertQuotationToInvoice(id: string) {
    return this.post(`/invoices/${id}/convert-to-invoice`);
  }

  getPurchaseOrders() {
    return this.get('/purchase-orders');
  }

  createPurchaseOrder(data: unknown) {
    return this.post('/purchase-orders', data);
  }

  convertPurchaseOrder(id: string) {
    return this.post(`/purchase-orders/${id}/convert`);
  }

  deletePurchaseOrder(id: string) {
    return this.delete(`/purchase-orders/${id}`);
  }

  getScheduledInvoices() {
    return this.get('/scheduled-invoices');
  }

  createScheduledInvoice(data: unknown) {
    return this.post('/scheduled-invoices', data);
  }

  generateScheduledInvoice(id: string) {
    return this.post(`/scheduled-invoices/${id}/generate`);
  }

  deleteScheduledInvoice(id: string) {
    return this.delete(`/scheduled-invoices/${id}`);
  }

  toggleScheduledInvoice(id: string) {
    return this.post(`/scheduled-invoices/${id}/toggle-active`);
  }

  processDueScheduledInvoices() {
    return this.post('/scheduled-invoices/process-due');
  }

  // Company settings
  getCompany() {
    return this.get('/companies/me');
  }

  updateCompany(data: unknown) {
    return this.put('/companies/me', data);
  }

  getCompanySecurity() {
    return this.get('/companies/me/security');
  }

  updateCompanySecurity(data: unknown) {
    return this.patch('/companies/me/security', data);
  }

  createDualControlRequest(data: {
    action: string;
    payload?: Record<string, unknown>;
    summary?: string;
  }) {
    return this.post<{
      id: string;
      action: string;
      status: string;
      expiresAt: string;
      summary?: string | null;
    }>('/dual-control/requests', data);
  }

  listPendingDualControlRequests() {
    return this.get<
      {
        id: string;
        action: string;
        status: string;
        summary?: string | null;
        expiresAt: string;
        createdAt: string;
        requestedBy?: { id: string; name: string; email: string };
      }[]
    >('/dual-control/requests/pending');
  }

  listDualControlHistory(limit?: number) {
    return this.get<
      {
        id: string;
        action: string;
        status: string;
        summary?: string | null;
        expiresAt: string;
        createdAt: string;
        updatedAt?: string;
        decisionNote?: string | null;
        requestedBy?: { id: string; name: string; email: string };
        decidedBy?: { id: string; name: string; email: string } | null;
      }[]
    >('/dual-control/requests/history', {
      params: limit ? { limit } : undefined,
    });
  }

  getDualControlRequest(id: string) {
    return this.get<{
      id: string;
      action: string;
      status: string;
      summary?: string | null;
      expiresAt: string;
    }>(`/dual-control/requests/${id}`);
  }

  decideDualControlRequest(id: string, data: { approve: boolean; note?: string }) {
    return this.post(`/dual-control/requests/${id}/decide`, data);
  }

  getPeriods(year?: number) {
    return this.get('/periods', { params: year ? { year } : {} });
  }

  lockPeriod(year: number, month: number) {
    return this.post(`/periods/${year}/${month}/lock`);
  }

  unlockPeriod(year: number, month: number) {
    return this.post(`/periods/${year}/${month}/unlock`);
  }

  // Users
  getUsers() {
    return this.get('/users');
  }

  createUser(data: unknown) {
    return this.post('/users', data);
  }

  updateUser(id: string, data: unknown) {
    return this.put(`/users/${id}`, data);
  }

  deleteUser(id: string) {
    return this.delete(`/users/${id}`);
  }

  // VAT / OTA
  getVatInvoices() {
    return this.get('/vat/invoices');
  }

  getVatStats() {
    return this.get('/vat/stats');
  }

  submitVatInvoice(invoiceId: string) {
    return this.post(`/vat/submit/${invoiceId}`);
  }

  getOtaConfig() {
    return this.get('/vat/ota-config');
  }

  updateOtaConfig(data: {
    mode?: 'mock' | 'sandbox' | 'live';
    apiBaseUrl?: string;
    clientId?: string;
    taxpayerTin?: string;
    clientSecretConfigured?: boolean;
  }) {
    return this.post('/vat/ota-config', data);
  }

  // AI
  getAiAnalytics() {
    return this.get('/ai/analytics');
  }

  proposeAiSuggestions() {
    return this.post('/ai/propose');
  }

  // Messaging / integrations
  getMessagingStatus() {
    return this.get('/messaging/status');
  }

  getMessagingReadme() {
    return this.get('/messaging/readme');
  }

  testMessaging(data: { channel: 'whatsapp' | 'email' | 'sms'; to: string; body?: string }) {
    return this.post('/messaging/test', data);
  }

  // Hisaby POS
  getPosLinkStatus() {
    return this.get<{
      linked: boolean;
      companyId: string;
      companyName: string;
      keyPrefix: string | null;
      warehouseId: string | null;
      warehouse: {
        id: string;
        code: string;
        name: string;
        nameEn: string | null;
        sector: string;
      } | null;
      restoLinked?: boolean;
      apps: { accounting: boolean; pos: boolean; resto?: boolean };
    }>('/pos/link-status');
  }

  activatePosLink(warehouseId?: string) {
    return this.post('/pos/link/activate', warehouseId ? { warehouseId } : {});
  }

  setPosWarehouse(warehouseId: string) {
    return this.post('/pos/link/warehouse', { warehouseId });
  }

  deactivatePosLink() {
    return this.post('/pos/link/deactivate');
  }

  generatePosLinkKey(warehouseId?: string) {
    return this.post<{ key: string; prefix: string; linked: boolean; warning: string }>(
      '/pos/link/generate',
      warehouseId ? { warehouseId } : {},
    );
  }

  confirmPosLinkKey(key: string, warehouseId?: string) {
    return this.post('/pos/link', { key, warehouseId });
  }

  // Hisaby Restaurants
  getRestoLinkStatus() {
    return this.get<{
      linked: boolean;
      companyId: string;
      companyName: string;
      keyPrefix: string | null;
      warehouseId: string | null;
      warehouse: {
        id: string;
        code: string;
        name: string;
        nameEn: string | null;
        sector: string;
      } | null;
      posLinked: boolean;
      apps: { accounting: boolean; pos: boolean; resto: boolean };
    }>('/resto/link-status');
  }

  activateRestoLink(warehouseId?: string) {
    return this.post('/resto/link/activate', warehouseId ? { warehouseId } : {});
  }

  setRestoWarehouse(warehouseId: string) {
    return this.post('/resto/link/warehouse', { warehouseId });
  }

  deactivateRestoLink() {
    return this.post('/resto/link/deactivate');
  }

  generateRestoLinkKey(warehouseId?: string) {
    return this.post<{ key: string; prefix: string; linked: boolean; warning: string }>(
      '/resto/link/generate',
      warehouseId ? { warehouseId } : {},
    );
  }

  confirmRestoLinkKey(key: string, warehouseId?: string) {
    return this.post('/resto/link', { key, warehouseId });
  }

  getRestoMenu(q?: string, dayPart?: string) {
    return this.get<{
      items: Array<{
        id: string;
        name: string;
        nameEn: string | null;
        sku: string;
        barcode: string | null;
        price: string | number;
        basePrice?: string | number;
        dayPartPrices?: Partial<
          Record<'breakfast' | 'lunch' | 'dinner' | 'late', number>
        >;
        unit: string;
        category: string;
        images?: string[];
        image?: string | null;
        allergens?: string[];
        dietaryTags?: string[];
        dayParts?: string[];
        isTracked?: boolean;
        hasRecipe?: boolean;
        defaultStationId?: string | null;
        defaultStationName?: string | null;
      }>;
      count: number;
      warehouseId?: string | null;
      needsWarehouse?: boolean;
      dayPart?: string | null;
      currentDayPart?: string;
    }>('/resto/menu', {
      params: {
        ...(q ? { q } : {}),
        ...(dayPart ? { dayPart } : {}),
      },
    });
  }

  seedRestoDemoCatalog() {
    return this.post<{
      ok: boolean;
      branches: number;
      warehouses: number;
      products: number;
      message: string;
    }>('/resto/demo/seed', {});
  }

  purgeRestoDemoCatalog() {
    return this.post<{
      ok: boolean;
      deletedProducts: number;
      deletedWarehouses: number;
      deletedBranches: number;
    }>('/resto/demo/purge', {});
  }

  setRestoProductStation(productId: string, stationId: string | null) {
    return this.patch(`/resto/menu/${productId}/station`, { stationId });
  }

  setRestoProductAllergens(productId: string, allergens: string[]) {
    return this.patch<{ productId: string; allergens: string[] }>(
      `/resto/menu/${productId}/allergens`,
      { allergens },
    );
  }

  setRestoProductDietary(productId: string, dietaryTags: string[]) {
    return this.patch<{ productId: string; dietaryTags: string[] }>(
      `/resto/menu/${productId}/dietary`,
      { dietaryTags },
    );
  }

  setRestoProductDayParts(productId: string, dayParts: string[]) {
    return this.patch<{ productId: string; dayParts: string[] }>(
      `/resto/menu/${productId}/day-parts`,
      { dayParts },
    );
  }

  setRestoProductDayPartPrices(
    productId: string,
    prices: Partial<
      Record<'breakfast' | 'lunch' | 'dinner' | 'late', number | null>
    >,
  ) {
    return this.patch<{
      productId: string;
      dayPartPrices: Partial<
        Record<'breakfast' | 'lunch' | 'dinner' | 'late', number>
      >;
    }>(`/resto/menu/${productId}/day-part-prices`, prices);
  }

  getRestoReservations(days?: number) {
    return this.get<{
      from: string;
      to: string;
      count: number;
      reservations: Array<{
        id: string;
        guestName: string;
        phone: string | null;
        guests: number;
        reservedAt: string;
        status: string;
        notes: string | null;
        source?: string;
        tableId: string | null;
        table: { id: string; code: string; name: string | null } | null;
      }>;
    }>('/resto/reservations', {
      params: days ? { days } : undefined,
    });
  }

  createRestoReservation(data: {
    guestName: string;
    phone?: string;
    guests?: number;
    reservedAt: string;
    tableId?: string;
    notes?: string;
  }) {
    return this.post('/resto/reservations', data);
  }

  updateRestoReservationStatus(
    id: string,
    status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW',
  ) {
    return this.patch<{
      id: string;
      status: string;
      openedOrderId?: string | null;
    }>(`/resto/reservations/${id}/status`, { status });
  }

  notifyRestoReservation(
    id: string,
    kind: 'CONFIRM' | 'REMINDER' | 'TABLE_READY' = 'CONFIRM',
  ) {
    return this.post<{
      id: string;
      status: string;
      confirmUrl?: string;
      notify?: { ok: boolean; channel: string | null; error?: string };
    }>(`/resto/reservations/${id}/notify`, { kind });
  }

  getRestoRecipes() {
    return this.get<{
      count: number;
      recipes: Array<{
        id: string;
        productId: string;
        notes: string | null;
        deductsIngredients: boolean;
        warningTracked: string | null;
        product: {
          id: string;
          name: string;
          nameEn: string | null;
          sku: string;
          isTracked: boolean;
          price: string | number;
        };
        items: Array<{
          id: string;
          componentProductId: string;
          qty: string | number;
          component: {
            id: string;
            name: string;
            nameEn: string | null;
            sku: string;
            unit: string;
          };
        }>;
      }>;
    }>('/resto/recipes');
  }

  upsertRestoRecipe(
    productId: string,
    data: {
      notes?: string;
      items: Array<{ componentProductId: string; qty: number }>;
    },
  ) {
    return this.put(`/resto/recipes/${productId}`, data);
  }

  deleteRestoRecipe(productId: string) {
    return this.delete(`/resto/recipes/${productId}`);
  }

  getRestoFloor() {
    return this.get<{
      companyId: string;
      companyName: string;
      linked: boolean;
      empty: boolean;
      zones: Array<{
        id: string;
        name: string;
        nameEn: string | null;
        sectionServer?: {
          id: string;
          name: string;
          assignmentId: string;
        } | null;
        tables: Array<{
          id: string;
          code: string;
          name: string | null;
          seats: number;
          status: string;
          openOrder: {
            id: string;
            number: string;
            status: string;
            guests: number;
            itemCount: number;
            createdAt: string;
            occupiedMinutes?: number;
            guestItemCount?: number;
            total?: number;
          } | null;
        }>;
      }>;
      tables: Array<{
        id: string;
        code: string;
        name: string | null;
        seats: number;
        status: string;
        zoneId: string;
        zoneName: string;
        openOrder: {
          id: string;
          number: string;
          status: string;
          guests: number;
          itemCount: number;
        } | null;
      }>;
    }>('/resto/floor');
  }

  seedRestoFloor(tableCount?: number) {
    return this.post('/resto/floor/seed', { tableCount });
  }

  createRestoZone(data: { name: string; nameEn?: string }) {
    return this.post('/resto/zones', data);
  }

  createRestoTable(data: {
    zoneId: string;
    code: string;
    name?: string;
    seats?: number;
  }) {
    return this.post('/resto/tables', data);
  }

  openRestoOrder(data: {
    tableId?: string;
    channel?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
    guests?: number;
    notes?: string;
    guestName?: string;
    guestPhone?: string;
    deliveryAddress?: string;
  }) {
    return this.post<RestoOrderPayload>('/resto/orders', data);
  }

  ingestRestoExternalOrder(data: {
    channel: 'TAKEAWAY' | 'DELIVERY';
    externalChannel: string;
    externalOrderId: string;
    guestName?: string;
    guestPhone?: string;
    deliveryAddress?: string;
    notes?: string;
    autoSend?: boolean;
    items: Array<{
      productId?: string;
      sku?: string;
      barcode?: string;
      qty?: number;
      notes?: string;
      modifiers?: Array<{ name: string; priceDelta?: number }>;
    }>;
  }) {
    return this.post<RestoOrderPayload & { idempotent: boolean }>(
      '/resto/external/orders',
      data,
    );
  }

  getRestoActiveOrders(channel?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY') {
    return this.get<{
      count: number;
      channel: string | null;
      orders: Array<{
        id: string;
        number: string;
        channel: string;
        status: string;
        guests: number;
        notes: string | null;
        guestName?: string | null;
        guestPhone?: string | null;
        deliveryAddress?: string | null;
        deliveryStatus?: string | null;
        driverName?: string | null;
        driverPhone?: string | null;
        externalChannel?: string | null;
        externalOrderId?: string | null;
        createdAt: string;
        table: { id: string; code: string; name: string | null } | null;
        itemCount: number;
        total: number;
        items: Array<{
          id: string;
          name: string;
          qty: number;
          status: string;
          unitPrice: string | number;
        }>;
      }>;
    }>('/resto/orders', {
      params: channel ? { channel } : undefined,
    });
  }

  ensureRestoGuestTokens() {
    return this.post<{
      count: number;
      tables: Array<{
        id: string;
        code: string;
        name: string | null;
        zoneName: string;
        guestToken: string;
        path: string;
      }>;
    }>('/resto/tables/guest-tokens', {});
  }

  clearRestoGuestCall(tableId: string) {
    return this.post(`/resto/tables/${tableId}/clear-call`, {});
  }

  getRestoOrder(id: string) {
    return this.get<RestoOrderPayload>(`/resto/orders/${id}`);
  }

  addRestoOrderItem(
    orderId: string,
    data: {
      productId: string;
      qty?: number;
      notes?: string;
      stationId?: string;
      course?: number;
      seat?: number | null;
      modifiers?: Array<{ name: string; priceDelta?: number }>;
    },
  ) {
    return this.post<RestoOrderPayload>(`/resto/orders/${orderId}/items`, data);
  }

  updateRestoOrderItem(
    orderId: string,
    itemId: string,
    data: {
      qty?: number;
      notes?: string;
      course?: number;
      seat?: number | null;
    },
  ) {
    return this.patch<RestoOrderPayload>(
      `/resto/orders/${orderId}/items/${itemId}`,
      data,
    );
  }

  updateRestoOrder(
    orderId: string,
    data: {
      guests?: number;
      notes?: string;
      guestName?: string;
      guestPhone?: string;
      deliveryAddress?: string;
      tipAssigneeId?: string | null;
    },
  ) {
    return this.patch<RestoOrderPayload>(`/resto/orders/${orderId}`, data);
  }

  voidRestoOrderItem(
    orderId: string,
    itemId: string,
    data: {
      reason: string;
      comp?: boolean;
      approval?: DualApprovalPayload;
    },
  ) {
    return this.post<RestoOrderPayload>(
      `/resto/orders/${orderId}/items/${itemId}/void`,
      data,
    );
  }

  getRestoExpo() {
    return this.get<{
      count: number;
      sla?: { expoWarnMinutes: number };
      items: Array<{
        id: string;
        name: string;
        qty: number;
        notes: string | null;
        course: number;
        status: string;
        isRush?: boolean;
        heldAt?: string | null;
        readyAt: string | null;
        orderId: string;
        orderNumber: string;
        channel: string;
        guestName: string | null;
        stationName: string | null;
        table: { id: string; code: string; name: string | null } | null;
      }>;
    }>('/resto/expo');
  }

  transferRestoOrder(orderId: string, tableId: string) {
    return this.post<RestoOrderPayload>(`/resto/orders/${orderId}/transfer`, {
      tableId,
    });
  }

  mergeRestoOrder(orderId: string, targetOrderId: string) {
    return this.post<RestoOrderPayload>(`/resto/orders/${orderId}/merge`, {
      targetOrderId,
    });
  }

  splitRestoOrder(
    orderId: string,
    data: { itemIds: string[]; tableId?: string; guests?: number },
  ) {
    return this.post<{
      source: RestoOrderPayload;
      split: RestoOrderPayload;
    }>(`/resto/orders/${orderId}/split`, data);
  }

  getRestoModifiers() {
    return this.get<{
      modifiers: Array<{
        id: string;
        name: string;
        nameEn: string | null;
        priceDelta: number;
        sortOrder: number;
      }>;
    }>('/resto/modifiers');
  }

  createRestoModifier(data: {
    name: string;
    nameEn?: string;
    priceDelta?: number;
    sortOrder?: number;
  }) {
    return this.post('/resto/modifiers', data);
  }

  getRestoWaitlist() {
    return this.get<{
      count: number;
      entries: Array<{
        id: string;
        guestName: string;
        phone: string | null;
        guests: number;
        quotedMinutes: number | null;
        status: string;
        notes: string | null;
        waitedMinutes: number;
        createdAt: string;
        seatedOrderId?: string | null;
      }>;
    }>('/resto/waitlist');
  }

  createRestoWaitlist(data: {
    guestName: string;
    phone?: string;
    guests?: number;
    quotedMinutes?: number;
    notes?: string;
  }) {
    return this.post('/resto/waitlist', data);
  }

  updateRestoWaitlistStatus(
    id: string,
    data: {
      status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW';
      tableId?: string;
    },
  ) {
    return this.patch<{
      id: string;
      status: string;
      notify?: { ok: boolean; channel: string | null; error?: string } | null;
      order?: { id: string };
    }>(`/resto/waitlist/${id}/status`, data);
  }

  notifyRestoWaitlist(id: string) {
    return this.post<{
      id: string;
      status: string;
      notify?: { ok: boolean; channel: string | null; error?: string };
    }>(`/resto/waitlist/${id}/notify`, {});
  }

  getRestoMenu86() {
    return this.get<{
      items: Array<{
        id: string;
        productId: string;
        note: string | null;
        auto?: boolean;
        product: {
          id: string;
          name: string;
          nameEn: string | null;
          sku: string;
        } | null;
      }>;
    }>('/resto/menu/86');
  }

  setRestoMenu86(data: { productId: string; note?: string }) {
    return this.post('/resto/menu/86', data);
  }

  clearRestoMenu86(productId: string) {
    return this.delete(`/resto/menu/86/${productId}`);
  }

  reconcileRestoMenu86() {
    return this.post<{
      upserted: number;
      cleared: number;
      keptManual: number;
      auto86: number;
      warehouseId: string | null;
    }>('/resto/menu/86/reconcile', {});
  }

  /** Absolute URL for kitchen SSE (cookie auth, same-origin rewrite). */
  restoKitchenStreamUrl(stationId?: string) {
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}/backend-api`
        : API_URL;
    const q = stationId ? `?stationId=${encodeURIComponent(stationId)}` : '';
    return `${base}/resto/kitchen/stream${q}`;
  }

  restoExpoStreamUrl() {
    const base =
      typeof window !== 'undefined'
        ? `${window.location.origin}/backend-api`
        : API_URL;
    return `${base}/resto/expo/stream`;
  }

  removeRestoOrderItem(orderId: string, itemId: string) {
    return this.delete<RestoOrderPayload>(
      `/resto/orders/${orderId}/items/${itemId}`,
    );
  }

  sendRestoOrder(orderId: string, course?: number) {
    return this.post<RestoOrderPayload>(
      `/resto/orders/${orderId}/send`,
      course !== undefined ? { course } : {},
    );
  }

  createRestoPayLink(
    orderId: string,
    data?: {
      tipAmount?: number;
      tipAssigneeId?: string;
      serviceChargeAmount?: number;
      serviceChargePct?: number;
      warehouseId?: string;
      contactId?: string;
    },
  ) {
    return this.post<{
      orderId: string;
      invoiceId: string;
      payUrl: string | null;
      alreadyPaid: boolean;
      total: number;
    }>(`/resto/orders/${orderId}/pay-link`, data || {});
  }

  closeRestoOrder(
    orderId: string,
    data?: {
      soft?: boolean;
      paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
      payments?: Array<{
        method: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
        amount: number;
      }>;
      warehouseId?: string;
      contactId?: string;
      tipAmount?: number;
      tipAssigneeId?: string;
      loyaltyPointsToRedeem?: number;
      serviceChargeAmount?: number;
      serviceChargePct?: number;
    },
  ) {
    return this.post<RestoOrderPayload & { invoice?: { id: string } | null }>(
      `/resto/orders/${orderId}/close`,
      data || {},
    );
  }

  settleRestoBySeat(
    orderId: string,
    data: {
      seat: number;
      paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
      payments?: Array<{
        method: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
        amount: number;
      }>;
      tipAmount?: number;
      tipAssigneeId?: string;
      serviceChargePct?: number;
      contactId?: string;
      loyaltyPointsToRedeem?: number;
    },
  ) {
    return this.post<{
      source: RestoOrderPayload | null;
      closed: RestoOrderPayload & { invoice?: { id: string } | null };
      mode: 'full' | 'seat';
      seat?: number;
    }>(`/resto/orders/${orderId}/settle/by-seat`, data);
  }

  settleRestoEqual(
    orderId: string,
    data: {
      parts: number;
      paymentMethod?: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
      tipAmount?: number;
      tipAssigneeId?: string;
      serviceChargePct?: number;
      contactId?: string;
      loyaltyPointsToRedeem?: number;
    },
  ) {
    return this.post<RestoOrderPayload & { invoice?: { id: string } | null }>(
      `/resto/orders/${orderId}/settle/equal`,
      data,
    );
  }

  updateRestoDelivery(
    orderId: string,
    data: {
      deliveryStatus: 'QUEUED' | 'KITCHEN' | 'READY' | 'OUT' | 'DELIVERED';
      driverName?: string;
      driverPhone?: string;
    },
  ) {
    return this.patch<RestoOrderPayload>(`/resto/orders/${orderId}/delivery`, data);
  }

  cancelRestoOrder(orderId: string) {
    return this.post<RestoOrderPayload>(`/resto/orders/${orderId}/cancel`, {});
  }

  getRestoStations() {
    return this.get<{
      stations: Array<{
        id: string;
        name: string;
        nameEn: string | null;
        sortOrder: number;
        isActive: boolean;
      }>;
      count: number;
    }>('/resto/stations');
  }

  createRestoStation(data: { name: string; nameEn?: string; sortOrder?: number }) {
    return this.post('/resto/stations', data);
  }

  getRestoKitchen(stationId?: string) {
    return this.get<{
      items: Array<{
        id: string;
        name: string;
        nameEn?: string | null;
        qty: number;
        notes: string | null;
        course?: number;
        source?: string;
        status: string;
        isRush?: boolean;
        heldAt?: string | null;
        sentAt: string | null;
        readyAt?: string | null;
        stationId?: string | null;
        stationName?: string | null;
        allergens?: string[];
        orderId: string;
        orderNumber: string;
        orderNotes?: string | null;
        guestName?: string | null;
        channel?: string;
        table: { id: string; code: string; name: string | null } | null;
      }>;
      stations?: Array<{
        id: string;
        name: string;
        nameEn: string | null;
        sortOrder: number;
      }>;
      stationId?: string | null;
      sla?: { warnMinutes: number; criticalMinutes: number };
      count: number;
    }>('/resto/kitchen', {
      params: stationId ? { stationId } : undefined,
    });
  }

  setRestoKitchenItemStatus(
    itemId: string,
    status: 'PREPARING' | 'READY' | 'SERVED',
  ) {
    return this.post(`/resto/kitchen/items/${itemId}/status`, { status });
  }

  setRestoKitchenRush(itemId: string, rush: boolean) {
    return this.post(`/resto/kitchen/items/${itemId}/rush`, { rush });
  }

  setRestoKitchenHold(itemId: string, hold: boolean) {
    return this.post(`/resto/kitchen/items/${itemId}/hold`, { hold });
  }

  recallRestoKitchenItem(itemId: string, to: 'PREPARING' | 'READY') {
    return this.post(`/resto/kitchen/items/${itemId}/recall`, { to });
  }

  getRestoReportsSummary(days?: number) {
    return this.get<{
      from: string;
      to: string;
      days: number;
      orders: number;
      closed: number;
      cancelled: number;
      openNow: number;
      paidCloses: number;
      revenue: number;
      avgTicket: number;
      avgPrepMinutes: number;
      prepP50: number;
      prepP90: number;
      avgTableTurnMinutes: number;
      voidLines: number;
      compLines: number;
      sentLines: number;
      voidRate: number;
      compRate: number;
      tipsTotal: number;
      serviceChargesTotal: number;
      tippedCloses: number;
      avgTip: number;
      equalPoolShare: number;
      poolStaffCount: number;
      byServer: Array<{
        userId: string | null;
        name: string;
        tips: number;
        orders: number;
      }>;
      byHour: Array<{ hour: number; orders: number; revenue: number }>;
      byTable: Array<{
        label: string;
        orders: number;
        revenue: number;
        avgTurnMinutes: number | null;
      }>;
      byStationPrep: Array<{
        stationId: string | null;
        name: string;
        count: number;
        avg: number;
        p90: number;
      }>;
      voidReasons: Array<{ reason: string; count: number }>;
      topItems: Array<{ name: string; qty: number; revenue: number }>;
    }>('/resto/reports/summary', {
      params: days ? { days } : undefined,
    });
  }

  getRestoFlashReport() {
    return this.get<
      Awaited<ReturnType<ApiClient['getRestoReportsSummary']>>['data'] & {
        flash: boolean;
        printedAt: string;
        sectionAssignments: Array<{
          zoneId: string;
          zoneName: string;
          zoneNameEn: string | null;
          userId: string | null;
          user: { id: string; name: string; email: string; role: string } | null;
          startsAt: string | null;
        }>;
      }
    >('/resto/reports/flash');
  }

  getRestoLiveBoard() {
    return this.get<{
      asOf: string;
      businessDayFrom: string;
      timezone: string;
      companyName: string;
      house: {
        openTables: number;
        openCovers: number;
        openChecks: number;
        openRevenue: number;
        closedOrders: number;
        closedCovers: number;
        revenue: number;
        avgTicket: number;
        tipsTotal: number;
      };
      sections: Array<{
        zoneId: string;
        zoneName: string;
        zoneNameEn: string | null;
        server: { id: string; name: string } | null;
        openTables: number;
        openCovers: number;
        openChecks: number;
        openRevenue: number;
        avgOccupiedMinutes: number | null;
        closedToday: {
          orders: number;
          covers: number;
          revenue: number;
          avgTicket: number;
          tips: number;
        };
      }>;
      offFloor: {
        openChecks: number;
        openCovers: number;
        openRevenue: number;
        takeawayOpen: number;
        deliveryOpen: number;
        closedToday: {
          orders: number;
          covers: number;
          revenue: number;
          tips: number;
        };
      };
    }>('/resto/reports/live');
  }

  getRestoStaff() {
    return this.get<{
      staff: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
      }>;
    }>('/resto/staff');
  }

  getRestoSectionAssignments() {
    return this.get<{
      zones: Array<{ id: string; name: string; nameEn: string | null }>;
      assignments: Array<{
        zoneId: string;
        zoneName: string;
        zoneNameEn: string | null;
        assignmentId: string | null;
        userId: string | null;
        user: {
          id: string;
          name: string;
          email: string;
          role: string;
        } | null;
        startsAt: string | null;
      }>;
    }>('/resto/sections/assignments');
  }

  assignRestoSection(data: { zoneId: string; userId: string }) {
    return this.put<{
      zones: Array<{ id: string; name: string; nameEn: string | null }>;
      assignments: Array<{
        zoneId: string;
        zoneName: string;
        zoneNameEn: string | null;
        assignmentId: string | null;
        userId: string | null;
        user: {
          id: string;
          name: string;
          email: string;
          role: string;
        } | null;
        startsAt: string | null;
      }>;
    }>('/resto/sections/assignments', data);
  }

  releaseRestoSection(zoneId: string) {
    return this.delete<{
      zones: Array<{ id: string; name: string; nameEn: string | null }>;
      assignments: Array<{
        zoneId: string;
        zoneName: string;
        zoneNameEn: string | null;
        assignmentId: string | null;
        userId: string | null;
        user: {
          id: string;
          name: string;
          email: string;
          role: string;
        } | null;
        startsAt: string | null;
      }>;
    }>(`/resto/sections/assignments/${zoneId}`);
  }

  getRestoConfig() {
    return this.get<{
      timezone: string;
      currentDayPart: string;
      currentHour: number;
      dayParts: Record<string, { start: number; end: number }>;
      kitchenSla: {
        warnMinutes: number;
        criticalMinutes: number;
        expoWarnMinutes: number;
      };
      booking: {
        enabled: boolean;
        publicSlug: string | null;
        publicPath: string | null;
        publicUrl: string | null;
        maxParty: number;
        minParty: number;
        slotMinutes: number;
        horizonDays: number;
        openHour: number;
        closeHour: number;
        turnMinutes: number;
        autoConfirm: boolean;
        autoNotify: boolean;
      };
      defaults: Record<string, { start: number; end: number }>;
      slaDefaults: {
        warnMinutes: number;
        criticalMinutes: number;
        expoWarnMinutes: number;
      };
    }>('/resto/config');
  }

  updateRestoConfig(data: {
    dayParts?: Partial<
      Record<
        'breakfast' | 'lunch' | 'dinner' | 'late',
        { start: number; end: number }
      >
    >;
    kitchenSla?: {
      warnMinutes?: number;
      criticalMinutes?: number;
      expoWarnMinutes?: number;
    };
    booking?: {
      enabled?: boolean;
      publicSlug?: string | null;
      maxParty?: number;
      minParty?: number;
      slotMinutes?: number;
      horizonDays?: number;
      openHour?: number;
      closeHour?: number;
      turnMinutes?: number;
      autoConfirm?: boolean;
      autoNotify?: boolean;
    };
  }) {
    return this.put<{
      timezone: string;
      currentDayPart: string;
      currentHour: number;
      dayParts: Record<string, { start: number; end: number }>;
      kitchenSla: {
        warnMinutes: number;
        criticalMinutes: number;
        expoWarnMinutes: number;
      };
      booking: {
        enabled: boolean;
        publicSlug: string | null;
        publicPath: string | null;
        publicUrl: string | null;
        maxParty: number;
        minParty: number;
        slotMinutes: number;
        horizonDays: number;
        openHour: number;
        closeHour: number;
        turnMinutes: number;
        autoConfirm: boolean;
        autoNotify: boolean;
      };
      defaults: Record<string, { start: number; end: number }>;
      slaDefaults: {
        warnMinutes: number;
        criticalMinutes: number;
        expoWarnMinutes: number;
      };
    }>('/resto/config', data);
  }

  lookupRestoLoyalty(phone: string) {
    return this.get<{
      found: boolean;
      phone: string | null;
      contactId: string | null;
      name: string | null;
      points: number;
      customerEnabled: boolean;
      redeemEnabled: boolean;
      pointsPerUnit?: number;
      redeemPointsPerUnit?: number;
    }>('/resto/loyalty/lookup', { params: { phone } });
  }

  attachRestoLoyalty(
    orderId: string,
    data: { contactId?: string | null; phone?: string; name?: string },
  ) {
    return this.post<RestoOrderPayload>(`/resto/orders/${orderId}/loyalty`, data);
  }

  lookupPosProduct(code: string, warehouseId?: string) {
    return this.get(`/pos/products/lookup`, {
      params: { code, ...(warehouseId ? { warehouseId } : {}) },
    });
  }

  searchPosProducts(q?: string, warehouseId?: string) {
    return this.get('/pos/products/search', {
      params: {
        ...(q ? { q } : {}),
        ...(warehouseId ? { warehouseId } : {}),
      },
    });
  }

  syncPosCatalog(warehouseId?: string) {
    return this.get<{
      warehouseId: string | null;
      syncedAt: string;
      count: number;
      products: unknown[];
      full?: boolean;
    }>('/pos/catalog/sync', {
      params: warehouseId ? { warehouseId } : {},
    });
  }

  syncPosStock(warehouseId?: string, since?: string) {
    return this.get<{
      warehouseId: string | null;
      syncedAt: string;
      count: number;
      products: unknown[];
      full?: boolean;
      since?: string;
    }>('/pos/stock/sync', {
      params: {
        ...(warehouseId ? { warehouseId } : {}),
        ...(since ? { since } : {}),
      },
    });
  }

  getPosPartnerGateways() {
    return this.get('/pos/partner-pay/gateways');
  }

  createPosPartnerCheckout(
    invoiceId: string,
    data?: { gatewaySlug?: string; customerEmail?: string },
  ) {
    return this.post(`/pos/sales/${invoiceId}/partner-checkout`, data || {});
  }

  startPosTerminalTap(
    invoiceId: string,
    data?: { gatewaySlug?: string; customerEmail?: string; mode?: 'mock' | 'hosted' | 'softpos' },
  ) {
    return this.post(`/pos/sales/${invoiceId}/terminal-tap`, data || {});
  }

  getPosTerminalTap(invoiceId: string) {
    return this.get<{
      invoiceId: string;
      invoiceNumber?: string;
      paid: boolean;
      invoiceStatus?: string;
      session?: { status?: string; mode?: string } | null;
    }>(`/pos/sales/${invoiceId}/terminal-tap`);
  }

  confirmPosTerminalTapMock(invoiceId: string) {
    return this.post(`/pos/sales/${invoiceId}/terminal-tap/confirm-mock`, {});
  }

  createPosSale(data: {
    items: { productId: string; quantity: number; unitPrice?: number; discount?: number; notes?: string }[];
    paymentMethod?: string;
    payments?: { method: string; amount: number }[];
    tipAmount?: number;
    tipAssigneeId?: string;
    useStoreCredit?: boolean;
    partnerCheckout?: boolean;
    taxRate?: number;
    notes?: string;
    warehouseId?: string;
    contactId?: string;
    clientSaleId?: string;
    parkedDraftId?: string;
    loyaltyPointsToRedeem?: number;
    approval?: DualApprovalPayload;
    allowNegativeStock?: boolean;
  }) {
    return this.post('/pos/sales', data);
  }

  getPosSaleByNumber(number: string) {
    return this.get('/pos/sales/by-number', {
      params: { number },
    });
  }

  listRecentPosSales(opts?: { take?: number; warehouseId?: string; q?: string }) {
    const params = new URLSearchParams();
    if (opts?.take) params.set('take', String(opts.take));
    if (opts?.warehouseId) params.set('warehouseId', opts.warehouseId);
    if (opts?.q?.trim()) params.set('q', opts.q.trim());
    const q = params.toString();
    return this.get<
      {
        id: string;
        number: string;
        total: number | string;
        date?: string;
        createdAt?: string;
        status?: string;
        notes?: string | null;
        warehouseId?: string | null;
        contact?: { id: string; name: string; phone?: string | null } | null;
        items?: {
          productId?: string | null;
          description: string;
          quantity: number | string;
          unitPrice?: number | string;
          total: number | string;
          notes?: string | null;
          product?: { barcode?: string | null; sku?: string | null } | null;
        }[];
        payments?: { method?: string; amount?: number | string }[];
        reprintCount?: number;
      }[]
    >(`/pos/sales/recent${q ? `?${q}` : ''}`);
  }

  voidPosSale(id: string, body?: { approval?: DualApprovalPayload }) {
    return this.post(`/pos/sales/${id}/void`, body || {});
  }

  resendPosSaleNotify(id: string) {
    return this.post<{
      ok: boolean;
      delivery?: { whatsapp?: string; email?: string; sms?: string };
    }>(`/pos/sales/${id}/notify`);
  }

  refundPosSale(
    id: string,
    body: {
      items: { productId: string; quantity: number }[];
      reason?: string;
      refundMethod?: 'ORIGINAL' | 'CASH' | 'STORE_CREDIT';
      approval?: DualApprovalPayload;
    },
  ) {
    return this.post(`/pos/sales/${id}/refund`, body);
  }

  /** No-receipt return (manager dual-control). */
  blindPosReturn(body: {
    items: { productId: string; quantity: number; unitPrice?: number }[];
    reason: string;
    refundMethod?: 'CASH' | 'STORE_CREDIT';
    contactId?: string;
    warehouseId?: string;
    approval?: DualApprovalPayload;
  }) {
    return this.post<{
      refunded: boolean;
      blind: boolean;
      creditNote: { id: string; number: string; total: number | string };
    }>('/pos/returns/blind', body);
  }

  getCurrentPosShift(warehouseId?: string) {
    const q = warehouseId ? `?warehouseId=${encodeURIComponent(warehouseId)}` : "";
    return this.get<{
      shift: {
        id: string;
        status: string;
        openingFloat: number;
        openedAt: string;
        warehouseId?: string | null;
        openedBy?: { name: string };
        warehouse?: { id: string; name: string; code: string } | null;
      } | null;
      live?: Record<string, number | string | null | unknown>;
      cashMovements?: {
        id: string;
        type: string;
        amount: number | string;
        reason?: string | null;
        createdAt: string;
        createdBy?: { id: string; name: string };
      }[];
    }>(`/pos/shifts/current${q}`);
  }

  createPosCashMovement(data: {
    type: 'IN' | 'OUT';
    amount: number;
    reason?: string;
    warehouseId?: string;
    approval?: DualApprovalPayload;
  }) {
    return this.post<{
      movement: {
        id: string;
        type: string;
        amount: number | string;
        reason?: string | null;
        journalId?: string | null;
        createdAt: string;
      };
      live?: Record<string, unknown>;
      cashMovements?: unknown[];
      journalId?: string | null;
      postedToGl?: boolean;
    }>('/pos/shifts/current/cash-movements', data);
  }

  createPosNoSale(data: {
    reason: string;
    warehouseId?: string;
    approval?: DualApprovalPayload;
  }) {
    return this.post<{
      movement: {
        id: string;
        type: string;
        amount: number | string;
        reason?: string | null;
        createdAt: string;
      };
      cashMovements?: unknown[];
      shift?: { id: string };
    }>('/pos/shifts/current/no-sale', data);
  }

  getPosCustomerRecentSales(contactId: string) {
    return this.get<{
      contact: { id: string; name: string };
      sales: {
        id: string;
        number: string;
        total: number | string;
        date?: string;
        createdAt?: string;
        status?: string;
        notes?: string | null;
        items?: {
          productId?: string | null;
          description: string;
          quantity: number | string;
          unitPrice?: number | string;
          total: number | string;
        }[];
        payments?: { method?: string }[];
      }[];
    }>(`/pos/customers/${encodeURIComponent(contactId)}/recent-sales`);
  }

  getPosTodayStats(warehouseId?: string) {
    const params = new URLSearchParams();
    if (warehouseId) params.set('warehouseId', warehouseId);
    params.set('cashierId', 'me');
    const q = params.toString();
    return this.get<{
      salesCount: number;
      salesTotal: number;
      refundCount: number;
      voidCount: number;
      from?: string;
      cashierId?: string | null;
      mine?: {
        salesCount: number;
        salesTotal: number;
        refundCount: number;
        voidCount: number;
      };
      store?: {
        salesCount: number;
        salesTotal: number;
        refundCount: number;
        voidCount: number;
      };
    }>(`/pos/stats/today?${q}`);
  }

  recordPosSaleReprint(id: string, variant?: "STANDARD" | "GIFT") {
    return this.post<{
      id: string;
      number: string;
      reprintCount: number;
      variant?: string;
    }>(`/pos/sales/${encodeURIComponent(id)}/reprint`, {
      variant: variant || "STANDARD",
    });
  }

  getPosBooksSummary() {
    return this.get<{
      linked: boolean;
      currency: string;
      plan: string;
      monthFrom: string;
      today: {
        salesCount: number;
        salesTotal: number;
        refundCount: number;
        voidCount: number;
      };
      revenue: number;
      salesCount: number;
      expenses: number;
      expenseCount: number;
      refunds: number;
      refundCount: number;
      voidedTotal: number;
      voidCount: number;
      cashIn: number;
      cashInCount: number;
      net: number;
      recentSales: { id: string; number: string; total: number; createdAt: string }[];
      recentExpenses: {
        id: string;
        amount: number;
        reason?: string | null;
        createdAt: string;
        createdBy?: string | null;
      }[];
    }>("/pos/books/summary");
  }

  getPosShiftsToday() {
    return this.get<{
      date: string;
      warehouses: {
        warehouseId: string | null;
        warehouseName: string;
        warehouseCode: string | null;
        openShift: {
          id: string;
          openedAt: string;
          openedBy?: { id: string; name: string } | null;
        } | null;
        shifts: {
          id: string;
          status: string;
          openedAt: string;
          closedAt: string | null;
          openedBy?: { id: string; name: string } | null;
          salesTotal: number;
          cashIn: number;
          cashOut: number;
          expectedCash: number;
          voidCount?: number;
          voidedTotal?: number;
        }[];
        salesTotal: number;
        cashIn: number;
        cashOut: number;
        expectedCash: number;
        voidCount?: number;
        voidedTotal?: number;
      }[];
      totals: {
        salesTotal: number;
        cashIn: number;
        cashOut: number;
        expectedCash: number;
        voidCount?: number;
        voidedTotal?: number;
        openCount: number;
        shiftCount: number;
      };
    }>('/pos/stats/shifts-today');
  }

  listPosShifts() {
    return this.get('/pos/shifts');
  }

  openPosShift(data?: {
    openingCash?: number;
    openingFloat?: number;
    warehouseId?: string;
    notes?: string;
  }) {
    return this.post('/pos/shifts/open', data || {});
  }

  closePosShift(data: {
    closingCash: number;
    notes?: string;
    warehouseId?: string;
    denominationCounts?: Record<string, number>;
    approval?: DualApprovalPayload;
  }) {
    return this.post<{
      shift: { id: string; closedAt?: string; closingCash?: number | string };
      zReport: Record<string, unknown>;
    }>('/pos/shifts/close', data);
  }

  getPosZReport(shiftId: string) {
    return this.get<{ shift: unknown; zReport: Record<string, unknown> }>(
      `/pos/shifts/${shiftId}/z-report`,
    );
  }

  getPosXReport(opts?: { shiftId?: string; warehouseId?: string }) {
    if (opts?.shiftId) {
      return this.get<{
        shift: unknown;
        xReport: Record<string, unknown>;
        reportType: 'X';
      }>(`/pos/shifts/${opts.shiftId}/x-report`);
    }
    return this.get<{
      shift: unknown;
      xReport: Record<string, unknown>;
      reportType: 'X';
    }>('/pos/shifts/current/x-report', {
      params: opts?.warehouseId ? { warehouseId: opts.warehouseId } : {},
    });
  }

  requestWhatsappOtp(action: string) {
    return this.post('/dual-control/whatsapp-otp', { action });
  }

  listPosDrafts() {
    return this.get<
      {
        id: string;
        name: string;
        notes?: string | null;
        warehouseId: string | null;
        contactId: string | null;
        contact?: { id: string; name: string; phone?: string | null } | null;
        linesJson: unknown;
        createdAt: string;
        updatedAt: string;
      }[]
    >('/pos/drafts');
  }

  createPosDraft(data: {
    name?: string;
    notes?: string;
    warehouseId?: string;
    contactId?: string;
    heldAmount?: number;
    heldMethod?: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER';
    suspendReason: string;
    lines: {
      productId: string;
      name: string;
      sku: string;
      unitPrice: number;
      quantity: number;
      stock?: number;
      isTracked?: boolean;
      discount?: number;
      notes?: string;
      catalogPrice?: number;
      barcode?: string | null;
    }[];
  }) {
    return this.post('/pos/drafts', data);
  }

  deletePosDraft(id: string, body?: { approval?: DualApprovalPayload }) {
    if (body?.approval) {
      return this.post(`/pos/drafts/${id}/discard`, body);
    }
    return this.delete(`/pos/drafts/${id}`);
  }

  topUpPosStoreCredit(data: {
    contactId: string;
    amount: number;
    method: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER';
    warehouseId?: string;
    notes?: string;
    bankAccountId?: string;
  }) {
    return this.post<{
      contact: { id: string; name: string; storeCreditBalance: number };
      amount: number;
      method: string;
      cashMovementId?: string | null;
    }>('/pos/store-credit/top-up', data);
  }

  updatePosDraft(id: string, data: { name?: string; notes?: string }) {
    return this.patch(`/pos/drafts/${id}`, data);
  }

  getPosIncentivesConfig() {
    return this.get<{
      cashierEnabled?: boolean;
      cashierPercent?: number;
      cashierBonusTiers?: { minSales: number; bonusAmount: number }[];
      customerEnabled?: boolean;
      customerPointsPerUnit?: number;
      redeemEnabled?: boolean;
      redeemPointsPerUnit?: number;
      receiptFooter?: string;
      favoriteProductIds?: string[];
    }>("/pos/incentives/config");
  }

  getPosFavorites() {
    return this.get<{ productIds: string[] }>("/pos/favorites");
  }

  putPosFavorites(productIds: string[]) {
    return this.put<{ productIds: string[] }>("/pos/favorites", { productIds });
  }

  updatePosIncentivesConfig(data: {
    cashierEnabled?: boolean;
    cashierPercent?: number;
    cashierBonusTiers?: { minSales: number; bonusAmount: number }[];
    customerEnabled?: boolean;
    customerPointsPerUnit?: number;
    redeemEnabled?: boolean;
    redeemPointsPerUnit?: number;
    receiptFooter?: string;
  }) {
    return this.patch("/pos/incentives/config", data);
  }

  getMyPosIncentives() {
    return this.get<{
      earned: number;
      paid: number;
      remaining: number;
      todaySales: number;
      todayCommission: number;
      nextTier?: {
        minSales: number;
        bonusAmount: number;
        progress: number;
      } | null;
      config: {
        cashierEnabled?: boolean;
        cashierPercent?: number;
        cashierBonusTiers?: { minSales: number; bonusAmount: number }[];
        customerEnabled?: boolean;
        customerPointsPerUnit?: number;
      };
    }>("/pos/incentives/me");
  }

  getMyPosIncentivesLedger(take = 5) {
    return this.get<
      {
        id: string;
        type: string;
        amount: number | string;
        note?: string | null;
        invoiceId?: string | null;
        createdAt: string;
      }[]
    >(`/pos/incentives/me/ledger?take=${take}`);
  }

  payoutPosCommission(data: {
    userId: string;
    amount: number;
    note?: string;
    warehouseId?: string;
    deductFromDrawer?: boolean;
  }) {
    return this.post("/pos/incentives/payout", data);
  }

  getPosShiftAnomalies(shiftId: string) {
    return this.get<{
      score: number;
      overallRisk: string;
      summaryAr: string;
      summaryEn: string;
      llmNote?: string | null;
      findings: {
        id: string;
        severity: string;
        messageAr: string;
        messageEn: string;
      }[];
    }>(`/ai/shifts/${encodeURIComponent(shiftId)}/anomalies`);
  }

  getPosCustomerPoints(contactId: string) {
    return this.get<{
      contactId: string;
      name: string;
      points: number;
      customerEnabled: boolean;
      pointsPerUnit: number;
      redeemEnabled?: boolean;
      redeemPointsPerUnit?: number;
      receiptFooter?: string;
    }>(`/pos/incentives/customers/${encodeURIComponent(contactId)}/points`);
  }
}

export const api = new ApiClient();
export default api;
