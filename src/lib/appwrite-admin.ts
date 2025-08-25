import { Client, Account, Databases, Functions } from "appwrite";
import { DATABASE_ID, COLLECTIONS } from "./appwrite";

/**
 * Creates an Appwrite client with admin privileges for server-side operations
 * This client should only be used in trusted contexts like webhooks, API routes, and server-side functions
 */
export function createAppwriteAdmin() {
  const appwriteEndpoint = process.env.PUBLIC_APPWRITE_ENDPOINT || import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
  const appwriteProjectId = process.env.PUBLIC_APPWRITE_PROJECT_ID || import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
  const appwriteApiKey = process.env.APPWRITE_API_KEY || import.meta.env.APPWRITE_API_KEY;

  if (!appwriteEndpoint || !appwriteProjectId || !appwriteApiKey) {
    throw new Error("Missing Appwrite configuration for admin operations");
  }

  const client = new Client()
    .setEndpoint(appwriteEndpoint)
    .setProject(appwriteProjectId)
    .setKey(appwriteApiKey);

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    functions: new Functions(client)
  };
}

/**
 * Handle database errors with more user-friendly messages
 */
export function handleDatabaseError(error: any) {
  let errorMessage = error.message;

  if (error.message.includes("permission")) {
    errorMessage = "Database access denied - please check permissions";
  } else if (error.message.includes("duplicate")) {
    errorMessage = "Duplicate entry detected";
  } else if (error.message.includes("not found")) {
    errorMessage = "Resource not found";
  } else if (error.message.includes("required")) {
    errorMessage = "Required field is missing";
  }

  return {
    message: errorMessage,
    originalError: process.env.NODE_ENV === "development" ? error : undefined,
  };
}

/**
 * Find user ID by email address in Appwrite
 * Searches through users collection by email
 */
export async function getUserIdByEmail(
  email: string,
  adminClient?: ReturnType<typeof createAppwriteAdmin>
): Promise<string | null> {
  const client = adminClient || createAppwriteAdmin();

  try {
    // Query users by email - assuming users collection exists
    const response = await client.databases.listDocuments(
      DATABASE_ID,
      'users', // This would be the users collection ID in Appwrite
      [
        // Appwrite uses Query objects for filtering
        // Note: This will need to be adjusted based on actual Appwrite schema
      ]
    );

    // Filter results by email since Appwrite queries might be different
    const user = response.documents.find(user => 
      user.email.toLowerCase() === email.toLowerCase()
    );

    if (user) {
      return user.$id;
    }

    // If not found in main users, check additional emails if that collection exists
    try {
      const additionalEmailsResponse = await client.databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.ADDITIONAL_EMAILS,
        []
      );

      const additionalEmail = additionalEmailsResponse.documents.find(email_doc => 
        email_doc.email_address.toLowerCase() === email.toLowerCase() && 
        email_doc.verified === true
      );

      return additionalEmail?.user_id || null;
    } catch (additionalError) {
      console.error("Error finding user by additional email:", additionalError);
      return null;
    }

  } catch (error) {
    console.error("Error in getUserIdByEmail:", error);
    return null;
  }
}

/**
 * Get full user information by email address
 */
export async function getUserByEmail(
  email: string,
  adminClient?: ReturnType<typeof createAppwriteAdmin>
) {
  const client = adminClient || createAppwriteAdmin();

  try {
    // Query users by email
    const response = await client.databases.listDocuments(
      DATABASE_ID,
      'users',
      []
    );

    const user = response.documents.find(user => 
      user.email.toLowerCase() === email.toLowerCase()
    );

    if (user) {
      return user;
    }

    // Check additional emails with user join
    try {
      const additionalEmailsResponse = await client.databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.ADDITIONAL_EMAILS,
        []
      );

      const additionalEmail = additionalEmailsResponse.documents.find(email_doc => 
        email_doc.email_address.toLowerCase() === email.toLowerCase() && 
        email_doc.verified === true
      );

      if (additionalEmail) {
        // Get the user record by user_id
        const userResponse = await client.databases.getDocument(
          DATABASE_ID,
          'users',
          additionalEmail.user_id
        );
        return userResponse;
      }

      return null;
    } catch (additionalError) {
      console.error("Error finding user by additional email:", additionalError);
      return null;
    }

  } catch (error) {
    console.error("Error in getUserByEmail:", error);
    return null;
  }
}