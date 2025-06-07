import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";
import { generateObject } from "ai";
import {
	createGoogleGenerativeAI,
	google,
	type GoogleGenerativeAIProviderOptions,
} from "@ai-sdk/google";
import { z } from "zod";

// Schema for debt information extraction
const debtSchema = z.object({
	amount: z.number().min(0).describe("The debt amount in dollars"),
	vendor: z.string().describe("The name or identifier of the vendor/creditor"),
	description: z.string().describe("Brief description of what the debt is for"),
	dueDate: z.string().optional().describe("Due date if mentioned (ISO format)"),
	isDebtCollection: z
		.boolean()
		.describe("Whether this appears to be a debt collection notice"),
});

// Function to parse debt information using AI
async function parseDebtWithAI(emailText: string, fromEmail: string) {
	try {
		// Check if Google API key is available
		const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
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
		};
	}
}

export const POST: APIRoute = async ({ request }) => {
	try {
		const data = await request.json();

		// Check for opt-out keywords
		const optOutKeywords = ["STOP", "UNSUBSCRIBE", "OPT-OUT", "REMOVE"];
		const textBody = data.TextBody || "";
		const fromEmail = data.FromFull?.Email || "unknown";

		const hasOptOut = optOutKeywords.some((keyword) =>
			textBody.toUpperCase().includes(keyword)
		);

		if (hasOptOut) {
			// Log opt-out and don't process further
			const { error } = await supabase.from("debts").insert({
				vendor: fromEmail,
				amount: 0,
				raw_email: textBody,
				status: "opted_out",
			});

			if (error) {
				console.error("Error logging opt-out:", error);
				return new Response(JSON.stringify({ error: error.message }), {
					status: 500,
					headers: { "Content-Type": "application/json" },
				});
			}

			return new Response("Opt-out processed", { status: 200 });
		}

		// Parse debt information using AI
		const debtInfo = await parseDebtWithAI(textBody, fromEmail);

		// Insert debt record with AI-extracted information
		const { data: insertedDebt, error: insertError } = await supabase
			.from("debts")
			.insert({
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
				},
			})
			.select()
			.single();

		if (insertError) {
			console.error("Error inserting debt:", insertError);
			return new Response(JSON.stringify({ error: insertError.message }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		// Log the email receipt
		await supabase.from("audit_logs").insert({
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
			const supabaseUrl = process.env.SUPABASE_URL;
			const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

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
