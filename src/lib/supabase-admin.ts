import { createClient } from "@supabase/supabase-js";

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
