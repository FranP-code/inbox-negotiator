// This file has been migrated to appwrite-admin.ts
// The original Supabase admin functionality is now handled by Appwrite

/**
 * @deprecated Use appwrite-admin.ts instead
 * This file contained Supabase admin client functionality that has been migrated to Appwrite
 */

export function createSupabaseAdmin() {
  throw new Error('This function has been migrated to Appwrite. Use appwrite-admin.ts instead.');
}

export function handleDatabaseError(error: any) {
  throw new Error('This function has been migrated to Appwrite. Use appwrite-admin.ts instead.');
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  throw new Error('This function has been migrated to Appwrite. Use appwrite-admin.ts instead.');
}

export async function getUserByEmail(email: string) {
  throw new Error('This function has been migrated to Appwrite. Use appwrite-admin.ts instead.');
}
