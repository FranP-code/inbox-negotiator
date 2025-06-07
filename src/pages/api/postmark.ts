import type { APIRoute } from "astro";
import {
	createSupabaseAdmin,
	handleDatabaseError,
	getUserIdByEmail,
} from "../../lib/supabase-admin";
import { generateObject } from "ai";
import {
	createGoogleGenerativeAI,
} from "@ai-sdk/google";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// Schema for debt information extraction
const debtSchema = z.object({
	amount: z.number().min(0).describe("The debt amount in dollars"),
	vendor: z.string().describe("The name or identifier of the vendor/creditor"),
	description: z.string().describe("Brief description of what the debt is for"),
	dueDate: z.string().optional().describe("Due date if mentioned (ISO format)"),
	isDebtCollection: z
		.boolean()
		.describe("Whether this appears to be a debt collection notice"),
	successfullyParsed: z
		.boolean()
		.describe("Whether the debt information was successfully parsed"),
});

// Schema for opt-out detection
const optOutSchema = z.object({
	isOptOut: z.boolean().describe("Whether this email contains an opt-out request"),
	confidence: z
		.number()
		.min(0)
		.max(1)
		.describe("Confidence level of the opt-out detection"),
	reason: z
		.string()
		.describe("Explanation of why this was classified as opt-out or not"),
});

// Function to detect opt-out requests using AI
async function detectOptOutWithAI(emailText: string, fromEmail: string) {
	try {
		const googleApiKey =
			process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
			import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!googleApiKey) {
			console.warn("Google API key not configured, falling back to keyword detection");
			return null;
		}

		const result = await generateObject({
			model: createGoogleGenerativeAI({
				apiKey: googleApiKey,
			})("gemini-2.5-flash-preview-04-17"),
			system: `You are an expert at analyzing email content to detect opt-out requests.
			Analyze the email to determine if the sender is requesting to opt-out, unsubscribe, 
			or stop receiving communications. Consider:
			- Explicit opt-out keywords (STOP, UNSUBSCRIBE, REMOVE, etc.)
			- Implicit requests to stop communication
			- Context and tone indicating unwillingness to continue correspondence
			- Legal language requesting cessation of contact
			Be conservative - only flag as opt-out if you're confident it's a genuine request.`,
			prompt: `Analyze this email for opt-out intent:
			
			From: ${fromEmail}
			Content: ${emailText}`,
			schema: optOutSchema,
		});

		return result.object;
	} catch (error) {
		console.error("AI opt-out detection error:", error);
		return null;
	}
}

// Function to parse debt information using AI
async function parseDebtWithAI(emailText: string, fromEmail: string) {
	try {
		// Check if Google API key is available
		const googleApiKey =
			process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
			import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!googleApiKey) {
			console.warn(
				"Google API key not configured, falling back to regex parsing"
			);
			throw new Error("No Google API key configured");
		}

		const result = await generateObject({
			model: createGoogleGenerativeAI({
				apiKey: googleApiKey,
			})("gemini-2.5-flash-preview-04-17"),
			system: `You are an expert at analyzing debt collection and billing emails. 
      Extract key debt information from the email content. 
      Look for monetary amounts, creditor information, what the debt is for, and due dates.
      If this doesn't appear to be a legitimate debt or billing notice, set amount to 0.
      Be very accurate with amounts - look for dollar signs and numbers carefully.`,
			prompt: `Parse this email for debt information:
      
      From: ${fromEmail}
      Content: ${emailText}`,
			schema: debtSchema,
		});

		return result.object;
	} catch (error) {
		console.error("AI parsing error:", error);
		// Fallback to regex if AI fails
		const amountMatch = emailText.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
		return {
			amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0,
			vendor: fromEmail || "unknown",
			description: "Failed to parse with AI - using regex fallback",
			isDebtCollection: amountMatch ? true : false,
			successfullyParsed: false,
		};
	}
}


// Function to increment email processing usage
async function incrementEmailUsage(userId: string, supabaseAdmin: SupabaseClient) {
	try {
		// Call the database function to increment usage
		const { error } = await supabaseAdmin.rpc('increment_email_usage', {
			target_user_id: userId
		});

		if (error) {
			console.error("Error incrementing email usage:", error);
		}
	} catch (error) {
		console.error("Error calling increment_email_usage:", error);
	}
}

export const POST: APIRoute = async ({ request }) => {
	try {
		// Create service role client for webhook operations (bypasses RLS)
		let supabaseAdmin;
		try {
			supabaseAdmin = createSupabaseAdmin();
		} catch (configError) {
			console.error("Supabase admin configuration error:", configError);
			return new Response(
				JSON.stringify({ error: "Server configuration error" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		const data = await request.json();

		// Validate essential webhook data
		if (!data.TextBody && !data.HtmlBody) {
			return new Response(JSON.stringify({ error: "No email content found" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Check for opt-out keywords
		const textBody = data.TextBody || data.HtmlBody || "";
		const fromEmail = data.FromFull?.Email || data.From || "unknown";
		const toEmail = data.ToFull?.[0]?.Email || data.To || "";

		// Find the user who should receive this debt
		const userId = await getUserIdByEmail(toEmail, supabaseAdmin);
		if (!userId) {
			console.warn(`No user found for email: ${toEmail}`);
			return new Response("No matching user found", { status: 200 });
		}

		// Increment email processing usage
		await incrementEmailUsage(userId, supabaseAdmin);

		// Check for opt-out using AI
		const optOutDetection = await detectOptOutWithAI(textBody, fromEmail);
		let hasOptOut = false;

		if (optOutDetection) {
			hasOptOut = optOutDetection.isOptOut && optOutDetection.confidence > 0.7;
			console.log(`AI opt-out detection: ${hasOptOut} (confidence: ${optOutDetection.confidence})`);
		} else {
			// Fallback to keyword matching if AI is unavailable
			const optOutKeywords = ["STOP", "UNSUBSCRIBE", "OPT-OUT", "REMOVE"];
			hasOptOut = optOutKeywords.some((keyword) =>
				textBody.toUpperCase().includes(keyword)
			);
			console.log("Using fallback keyword opt-out detection");
		}

		if (hasOptOut) {
			// Log opt-out and don't process further
			const { error } = await supabaseAdmin.from("debts").insert({
				user_id: userId,
				vendor: fromEmail,
				amount: 0,
				raw_email: textBody,
				status: "opted_out",
			});

			if (error) {
				console.error("Error logging opt-out:", error);
				const errorInfo = handleDatabaseError(error);
				return new Response(JSON.stringify({ error: errorInfo.message }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response("Opt-out processed", { status: 200 });
		}

		// Parse debt information using AI
		const debtInfo = await parseDebtWithAI(textBody, fromEmail);

		if (!debtInfo || !debtInfo.successfullyParsed) {
			console.warn("Failed to parse debt information");
			return new Response(
				JSON.stringify({ error: "Failed to parse debt information" }),
				{
					status: 400,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		// Insert debt record with AI-extracted information
		const { data: insertedDebt, error: insertError } = await supabaseAdmin
			.from("debts")
			.insert({
				user_id: userId,
				vendor: debtInfo.vendor,
				amount: debtInfo.amount,
				raw_email: textBody,
				status: "received",
				description: debtInfo.description,
				due_date: debtInfo.dueDate,
				metadata: {
					isDebtCollection: debtInfo.isDebtCollection,
					subject: data.Subject,
					fromEmail: fromEmail,
					toEmail: toEmail,
				},
			})
			.select()
			.single();

		if (insertError) {
			console.error("Error inserting debt:", insertError);
			const errorInfo = handleDatabaseError(insertError);

			return new Response(
				JSON.stringify({
					error: errorInfo.message,
					details: errorInfo.originalError,
				}),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				}
			);
		}

		// Log the email receipt
		await supabaseAdmin.from("audit_logs").insert({
			debt_id: insertedDebt.id,
			action: "email_received",
			details: {
				vendor: debtInfo.vendor,
				amount: debtInfo.amount,
				subject: data.Subject,
				aiParsed: true,
			},
		});

		// Trigger negotiation function if this is a legitimate debt
		if (debtInfo.amount > 0 && debtInfo.isDebtCollection) {
			// Access environment variables through Astro runtime
			const supabaseUrl =
				process.env.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
			const supabaseAnonKey =
				process.env.SUPABASE_ANON_KEY ||
				import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

			if (supabaseUrl && supabaseAnonKey) {
				const negotiateUrl = `${supabaseUrl}/functions/v1/negotiate`;

				try {
					await fetch(negotiateUrl, {
						method: "POST",
						headers: {
							Authorization: `Bearer ${supabaseAnonKey}`,
							"Content-Type": "application/json",
						},
						body: JSON.stringify({ record: insertedDebt }),
					});
				} catch (negotiateError) {
					console.error("Error triggering negotiation:", negotiateError);
					// Don't fail the webhook if negotiation fails
				}
			} else {
				console.warn(
					"Supabase environment variables not configured for negotiation trigger"
				);
			}
		}

		return new Response("OK", { status: 200 });
	} catch (error) {
		console.error("Postmark webhook error:", error);
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
};
