import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client with service role key for server-side operations
 * This client bypasses Row Level Security (RLS) and should only be used in trusted contexts
 * like webhooks, API routes, and server-side functions
 */
export function createSupabaseAdmin() {
	const supabaseUrl =
		process.env.PUBLIC_SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
	const supabaseServiceKey =
		process.env.SUPABASE_SERVICE_ROLE_KEY ||
		import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

	console.log({ supabaseUrl, supabaseServiceKey });

	if (!supabaseUrl || !supabaseServiceKey) {
		throw new Error(
			"Missing Supabase URL or Service Role Key for admin operations"
		);
	}

	return createClient(supabaseUrl, supabaseServiceKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false,
		},
	});
}

/**
 * Handle database errors with more user-friendly messages
 */
export function handleDatabaseError(error: any) {
	let errorMessage = error.message;

	if (error.message.includes("row-level security")) {
		errorMessage = "Database access denied - please check RLS policies";
	} else if (error.message.includes("duplicate key")) {
		errorMessage = "Duplicate entry detected";
	} else if (error.message.includes("foreign key")) {
		errorMessage = "Invalid reference in data";
	} else if (error.message.includes("not null")) {
		errorMessage = "Required field is missing";
	}

	return {
		message: errorMessage,
		originalError: process.env.NODE_ENV === "development" ? error : undefined,
	};
}

/**
 * Find user ID by email address (primary or additional email)
 * First checks public.users table, then additional_emails if needed
 */
export async function getUserIdByEmail(
	email: string,
	supabaseAdmin?: SupabaseClient
): Promise<string | null> {
	const client = supabaseAdmin || createSupabaseAdmin();

	try {
		// First try to find user by primary email in public.users table
		const { data: primaryUser, error: primaryError } = await client
			.from("users")
			.select("id")
			.eq("email", email.toLowerCase())
			.maybeSingle();

		if (primaryError) {
			console.error("Error finding user by primary email:", primaryError);
		}

		if (primaryUser) {
			return primaryUser.id;
		}

		// If not found, check additional emails
		const { data: additionalEmail, error: additionalError } = await client
			.from("additional_emails")
			.select("user_id")
			.eq("email_address", email.toLowerCase())
			// TODO: START REQUIRING VERIFIED ADDITIONAL EMAILS
			// .eq("verified", true)
			.eq("verified", false)
			.maybeSingle();

		if (additionalError) {
			console.error("Error finding user by additional email:", additionalError);
			return null;
		}

		return additionalEmail?.user_id || null;
	} catch (error) {
		console.error("Error in getUserIdByEmail:", error);
		return null;
	}
}

/**
 * Get full user information by email address (primary or additional email)
 * First checks public.users table, then additional_emails if needed
 */
export async function getUserByEmail(
	email: string,
	supabaseAdmin?: SupabaseClient
) {
	const client = supabaseAdmin || createSupabaseAdmin();

	try {
		// First try to find user by primary email in public.users table
		const { data: primaryUser, error: primaryError } = await client
			.from("users")
			.select("*")
			.eq("email", email.toLowerCase())
			.maybeSingle();

		if (primaryError) {
			console.error("Error finding user by primary email:", primaryError);
		}

		if (primaryUser) {
			return primaryUser;
		}

		// If not found, check additional emails and join with users table
		const { data: userViaAdditionalEmail, error: additionalError } = await client
			.from("additional_emails")
			.select(`
				user_id,
				users!inner (
					id,
					email,
					created_at
				)
			`)
			.eq("email_address", email.toLowerCase())
			.eq("verified", true)
			.maybeSingle();

		if (additionalError) {
			console.error("Error finding user by additional email:", additionalError);
			return null;
		}

		return userViaAdditionalEmail?.users || null;
	} catch (error) {
		console.error("Error in getUserByEmail:", error);
		return null;
	}
}
