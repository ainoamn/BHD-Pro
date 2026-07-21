import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) return;

  await prisma.user.updateMany({
    where: { email: 'admin@qootk.com' },
    data: { email: 'admin@bhd.om' },
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { country: 'OM', currency: 'OMR', timezone: 'Asia/Muscat', name: 'شركة BHD التجريبية' },
  });

  const count = await prisma.contact.count({ where: { companyId: company.id } });
  if (count === 0) {
    await prisma.contact.createMany({
      data: [
        { name: 'شركة النخيل للتجارة', type: 'CUSTOMER', companyId: company.id, country: 'OM', email: 'info@nakhla.om', city: 'مسقط' },
        { name: 'مؤسسة الخليج', type: 'CUSTOMER', companyId: company.id, country: 'OM', email: 'contact@gulf.om', city: 'صلالة' },
        { name: 'شركة الصناعات العمانية', type: 'CUSTOMER', companyId: company.id, country: 'OM', city: 'صحار' },
      ],
    });
    console.log('Contacts seeded');
  }
}

main()
  .finally(() => prisma.$disconnect());
