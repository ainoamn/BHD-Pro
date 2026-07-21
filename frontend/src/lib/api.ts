import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;
  private refreshPromise: Promise<string> | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const { accessToken, company } = useAuthStore.getState();

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

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newToken = await this.refreshAccessToken();
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            useAuthStore.getState().logout();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const { refreshToken } = useAuthStore.getState();

    this.refreshPromise = this.client
      .post('/auth/refresh', { refreshToken })
      .then((response) => {
        const { accessToken } = response.data;
        useAuthStore.getState().setTokens(accessToken, refreshToken!);
        return accessToken;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    const { user, accessToken, refreshToken } = response.data;
    const company = user.company;
    useAuthStore.getState().login(
      { ...user, companyId: company?.id || user.companyId },
      company,
      accessToken,
      refreshToken
    );
    return response.data;
  }

  async register(data: { name: string; email: string; password: string; companyName: string; plan: string }) {
    const response = await this.client.post('/auth/register', data);
    const { user, accessToken, refreshToken } = response.data;
    const company = user.company;
    useAuthStore.getState().login(
      { ...user, companyId: company?.id || user.companyId },
      company,
      accessToken,
      refreshToken
    );
    return response.data;
  }

  async logout() {
    const { accessToken } = useAuthStore.getState();
    await this.client.post('/auth/logout', { token: accessToken });
    useAuthStore.getState().logout();
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
  getInvoices(params?: { isCash?: boolean; type?: string }) {
    return this.get('/invoices', {
      params: {
        ...(params?.isCash != null ? { isCash: String(params.isCash) } : {}),
        ...(params?.type ? { type: params.type } : {}),
      },
    });
  }

  getInvoiceStats(type?: string) {
    return this.get('/invoices/stats', { params: type ? { type } : {} });
  }

  getInvoice(id: string) {
    return this.get(`/invoices/${id}`);
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

  updateInvoiceStatus(id: string, status: string) {
    return this.patch(`/invoices/${id}/status`, { status });
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

  reverseAllInvoicePayments(invoiceId: string) {
    return this.post(`/invoices/${invoiceId}/payments/reverse-all`);
  }

  // Contacts
  getContacts(type?: string) {
    return this.get('/contacts', { params: type ? { type } : {} });
  }

  createContact(data: unknown) {
    return this.post('/contacts', data);
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

  getCompanyGateways() {
    return this.get('/payments/company-gateways');
  }

  updateCompanyGateway(slug: string, data: unknown) {
    return this.patch(`/payments/company-gateways/${slug}`, data);
  }

  createSubscriptionCheckout(data: unknown) {
    return this.post('/payments/subscription/checkout', data);
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

  getPayrollRuns() {
    return this.get('/payroll');
  }
  createPayrollRun(data: unknown) {
    return this.post('/payroll', data);
  }
  updatePayrollStatus(id: string, status: string) {
    return this.patch(`/payroll/${id}/status`, { status });
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

  payEmployeeClaim(id: string) {
    return this.post(`/employee-claims/${id}/pay`);
  }

  deleteEmployeeClaim(id: string) {
    return this.delete(`/employee-claims/${id}`);
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

  // AI
  getAiAnalytics() {
    return this.get('/ai/analytics');
  }
}

export const api = new ApiClient();
export default api;
