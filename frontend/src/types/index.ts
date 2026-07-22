export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'ACCOUNTANT' | 'VIEWER' | 'MANAGER';
  avatar?: string;
  companyId: string;
  company?: Company;
}

export interface Company {
  id: string;
  name: string;
  crNumber?: string;
  vatNumber?: string;
  address?: string;
  city?: string;
  country: string;
  phone?: string;
  email?: string;
  logo?: string;
  plan: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  currency: string;
  language: string;
  isActive: boolean;
  /** Apply VAT on invoices (default true) */
  applyVat?: boolean;
  /** Unit prices entered already include VAT */
  pricesIncludeTax?: boolean;
  /** VAT rate percent, default 5 for Oman */
  vatRate?: number;
  /** ELECTRONIC shows e-sign note; MANUAL shows blank signature lines */
  signatureMode?: "ELECTRONIC" | "MANUAL";
  /** Primary accent color for invoices / receipts (#RRGGBB) */
  documentColor?: string;
}

export interface Invoice {
  id: string;
  number: string;
  type: 'SALES' | 'PURCHASE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  customerId: string;
  customer?: Contact;
  date: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  paidAmount: number;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'PAID' | 'OVERDUE' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
  items: InvoiceItem[];
  vatUuid?: string;
  qrCode?: string;
  notes?: string;
}

export interface InvoiceItem {
  id: string;
  productId?: string;
  product?: Product;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  nameEn?: string;
  description?: string;
  category: string;
  barcode?: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
  maxQuantity?: number;
  reorderPoint: number;
  unit: string;
  warehouseId?: string;
  isActive: boolean;
  images: string[];
}

export interface Contact {
  id: string;
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
  name: string;
  nameEn?: string;
  taxId?: string;
  crNumber?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  address?: string;
  city?: string;
  country: string;
  zipCode?: string;
  openingBalance: number;
  currentBalance: number;
  creditLimit?: number;
  paymentTerms?: number;
  website?: string;
  notes?: string;
  isActive: boolean;
}

export interface Journal {
  id: string;
  number: string;
  date: string;
  description?: string;
  reference?: string;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  lines: JournalLine[];
  createdBy?: User;
}

export interface JournalLine {
  id: string;
  accountId: string;
  account?: Account;
  description?: string;
  debit: number;
  credit: number;
  costCenterId?: string;
}

export interface Account {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  category: string;
  parentId?: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  isBank: boolean;
  bankAccount?: string;
  bankName?: string;
}

export interface AiRecommendation {
  type: 'inventory' | 'revenue' | 'expense' | 'fraud' | 'growth';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  actionItems: string[];
  estimatedImpact: string;
}

export interface FinancialForecast {
  month: string;
  predictedRevenue: number;
  confidence: number;
}
