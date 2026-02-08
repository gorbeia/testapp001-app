import { db } from '../server/db';
import { superadmins } from '../shared/schema';
import bcrypt from 'bcrypt';

export async function seedSuperadmins() {
  console.log('🔐 Seeding superadmins...');

  const demoPassword = 'demo';
  const hashedPassword = await bcrypt.hash(demoPassword, 10);

  const demoSuperadmin = {
    email: 'superadmin@elkartea.eus',
    password: hashedPassword,
    name: 'Demo Superadmin',
    isActive: true,
  };

  await db.insert(superadmins).values(demoSuperadmin);
  console.log('✅ Demo superadmin created:');
  console.log(`   Email: ${demoSuperadmin.email}`);
  console.log(`   Password: ${demoPassword}`);
  console.log('   You can now log in at /elkarteapp/kudeaketa');
}
