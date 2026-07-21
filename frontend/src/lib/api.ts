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
  getInvoices() {
    return this.get('/invoices');
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

  updateContact(id: string, data: unknown) {
    return this.put(`/contacts/${id}`, data);
  }

  deleteContact(id: string) {
    return this.delete(`/contacts/${id}`);
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

  // Company settings
  getCompany() {
    return this.get('/companies/me');
  }

  updateCompany(data: unknown) {
    return this.put('/companies/me', data);
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
