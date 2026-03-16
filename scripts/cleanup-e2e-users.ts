import { config as dotenvConfig } from 'dotenv';
dotenvConfig({ path: '.env' });
dotenvConfig({ path: '.env.local', override: true });

import { createClerkClient } from '@clerk/backend';

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY ?? '',
});

async function listE2EUsers() {
  console.log('[E2E Cleanup] Fetching users from Clerk...\n');
  
  const users = await clerkClient.users.getUserList({
    limit: 100,
  });
  
  const e2eUsers = users.data.filter(user => {
    const email = user.emailAddresses[0]?.emailAddress || '';
    return email.includes('e2e-') || 
           email.includes('+clerk_test') ||
           email.includes('E2E Test');
  });
  
  console.log(`[E2E Cleanup] Found ${e2eUsers.length} E2E test users:\n`);
  
  e2eUsers.forEach(user => {
    const email = user.emailAddresses[0]?.emailAddress || 'no email';
    console.log(`  - ${user.id}: ${email}`);
  });
  
  return e2eUsers;
}

async function deleteE2EUsers() {
  const e2eUsers = await listE2EUsers();
  
  if (e2eUsers.length === 0) {
    console.log('\n[E2E Cleanup] No E2E users to delete.\n');
    return;
  }
  
  console.log(`\n[E2E Cleanup] Deleting ${e2eUsers.length} E2E test users...\n`);
  
  let successCount = 0;
  let failCount = 0;
  
  for (const user of e2eUsers) {
    try {
      await clerkClient.users.deleteUser(user.id);
      console.log(`  ✅ Deleted: ${user.id}`);
      successCount++;
    } catch (err) {
      console.error(`  ❌ Failed to delete ${user.id}:`, err instanceof Error ? err.message : err);
      failCount++;
    }
  }
  
  console.log(`\n[E2E Cleanup] Complete: ${successCount} deleted, ${failCount} failed\n`);
}

if (require.main === module) {
  deleteE2EUsers().catch(err => {
    console.error('[E2E Cleanup] Error:', err);
    process.exit(1);
  });
}

export { listE2EUsers, deleteE2EUsers };
