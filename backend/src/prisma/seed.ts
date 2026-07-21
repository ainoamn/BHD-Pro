import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const oldUser = await prisma.user.findUnique({ where: { email: 'admin@qootk.com' } });
  if (oldUser) {
    await prisma.user.update({
      where: { email: 'admin@qootk.com' },
      data: { email: 'admin@bhd.om' },
    });
  }

  let company = await prisma.company.findFirst({
    where: { users: { some: { email: 'admin@bhd.om' } } },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: 'شركة BHD التجريبية',
        crNumber: '1234567',
        vatNumber: 'OM1234567890',
        address: 'مسقط، سلطنة عُمان',
        city: 'مسقط',
        country: 'OM',
        phone: '+96891234567',
        email: 'info@bhd.om',
        plan: 'PROFESSIONAL',
        currency: 'OMR',
        language: 'ar',
        timezone: 'Asia/Muscat',
      },
    });

    const defaultAccounts = [
      { code: '1000', name: 'الأصول', type: 'ASSET' as const, category: 'CURRENT_ASSET' as const },
      { code: '1100', name: 'الصندوق', type: 'ASSET' as const, category: 'CURRENT_ASSET' as const },
      { code: '1200', name: 'البنك', type: 'ASSET' as const, category: 'CURRENT_ASSET' as const, isBank: true },
      { code: '1300', name: 'العملاء', type: 'ASSET' as const, category: 'CURRENT_ASSET' as const },
      { code: '2000', name: 'الخصوم', type: 'LIABILITY' as const, category: 'CURRENT_LIABILITY' as const },
      { code: '2100', name: 'الموردين', type: 'LIABILITY' as const, category: 'CURRENT_LIABILITY' as const },
      { code: '2200', name: 'ضريبة القيمة المضافة', type: 'LIABILITY' as const, category: 'CURRENT_LIABILITY' as const },
      { code: '3000', name: 'حقوق الملكية', type: 'EQUITY' as const, category: 'EQUITY' as const },
      { code: '4000', name: 'الإيرادات', type: 'REVENUE' as const, category: 'REVENUE' as const },
      { code: '5000', name: 'المصروفات', type: 'EXPENSE' as const, category: 'OPERATING_EXPENSE' as const },
    ];

    await prisma.account.createMany({
      data: defaultAccounts.map((acc) => ({ ...acc, companyId: company!.id })),
    });

    const hashedPassword = await bcrypt.hash('Admin123!', 12);
    await prisma.user.create({
      data: {
        name: 'مدير النظام',
        email: 'admin@bhd.om',
        password: hashedPassword,
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    console.log('Created company and admin user');
  }

  const demoCustomers = [
    {
      name: 'شركة النخيل للتجارة',
      type: 'CUSTOMER' as const,
      email: 'info@nakhla.om',
      phone: '+96891111111',
      city: 'مسقط',
      address: 'الخوير، شارع السلطان قابوس',
    },
    {
      name: 'مؤسسة الخليج',
      type: 'CUSTOMER' as const,
      email: 'contact@gulf.om',
      phone: '+96892222222',
      city: 'صلالة',
      address: 'السعادة، طريق صلالة',
    },
    {
      name: 'شركة الصناعات العمانية',
      type: 'CUSTOMER' as const,
      email: 'sales@omani.om',
      phone: '+96893333333',
      city: 'صحار',
      address: 'المنطقة الصناعية، صحار',
    },
    {
      name: 'مورد المواد الخام',
      type: 'SUPPLIER' as const,
      email: 'supply@raw.om',
      phone: '+96894444444',
      city: 'مسقط',
      address: 'الرصيف، مسقط',
    },
  ];

  for (const customer of demoCustomers) {
    const exists = await prisma.contact.findFirst({
      where: { companyId: company.id, name: customer.name },
    });
    if (!exists) {
      await prisma.contact.create({
        data: { ...customer, companyId: company.id, country: 'OM' },
      });
      console.log(`Added contact: ${customer.name}`);
    }
  }

  console.log('Seed completed!');
  console.log('Demo login: admin@bhd.om / Admin123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
