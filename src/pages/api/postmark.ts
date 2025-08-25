import type { APIRoute } from "astro";
import {
	createAppwriteAdmin,
	getUserIdByEmail,
	handleDatabaseError,
} from "../../lib/appwrite-admin";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { DATABASE_ID, COLLECTIONS } from "../../lib/appwrite";
import { ID } from "appwrite";

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
	isOptOut: z.boolean().describe(
		"Whether this email contains an opt-out request",
	),
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
		const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
			import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!googleApiKey) {
			console.warn(
				"Google API key not configured, falling back to keyword detection",
			);
			return null;
		}

		const result = await generateObject({
			model: createGoogleGenerativeAI({
				apiKey: googleApiKey,
			})("gemini-2.5-flash-preview-04-17"),
			system:
				`You are an expert at analyzing email content to detect opt-out requests.
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
		const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
			import.meta.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!googleApiKey) {
			console.warn(
				"Google API key not configured, falling back to regex parsing",
			);
			throw new Error("No Google API key configured");
		}

		const result = await generateObject({
			model: createGoogleGenerativeAI({
				apiKey: googleApiKey,
			})("gemini-2.5-flash-preview-04-17"),
			system:
				`You are an expert at analyzing debt collection and billing emails. 
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
async function incrementEmailUsage(
	userId: string,
	appwriteAdmin: ReturnType<typeof createAppwriteAdmin>,
) {
	try {
		// In Appwrite, we'll need to implement this differently since there are no stored procedures
		// For now, we'll implement a simple increment by finding the current month's usage and updating it
		
		const currentDate = new Date();
		const monthYear = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, '0')}`;
		
		// Get current usage for this month
		const response = await appwriteAdmin.databases.listDocuments(
			DATABASE_ID,
			COLLECTIONS.EMAIL_PROCESSING_USAGE,
			[] // In production: Query.equal('user_id', userId), Query.equal('month_year', monthYear)
		);
		
		const existingUsage = response.documents.find(doc => 
			doc.user_id === userId && doc.month_year === monthYear
		);
		
		if (existingUsage) {
			// Update existing usage
			await appwriteAdmin.databases.updateDocument(
				DATABASE_ID,
				COLLECTIONS.EMAIL_PROCESSING_USAGE,
				existingUsage.$id,
				{
					emails_processed: existingUsage.emails_processed + 1,
					updated_at: new Date().toISOString()
				}
			);
		} else {
			// Create new usage record
			await appwriteAdmin.databases.createDocument(
				DATABASE_ID,
				COLLECTIONS.EMAIL_PROCESSING_USAGE,
				ID.unique(),
				{
					user_id: userId,
					month_year: monthYear,
					emails_processed: 1,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString()
				}
			);
		}
	} catch (error) {
		console.error("Error incrementing email usage:", error);
	}
}

// Check if incoming email is a response to existing negotiation
async function checkForExistingNegotiation(
	fromEmail: string,
	toEmail: string,
	appwriteAdmin: ReturnType<typeof createAppwriteAdmin>,
) {
	try {
		// Look for debts where we've sent emails to this fromEmail and are awaiting response
		const response = await appwriteAdmin.databases.listDocuments(
			DATABASE_ID,
			COLLECTIONS.DEBTS,
			[] // In production: Query.in('status', ['sent', 'awaiting_response', 'counter_negotiating']), Query.orderDesc('last_message_at')
		);

		// Filter and sort on the client side for now
		const matchingDebts = response.documents.filter(debt => {
			const metadata = debt.metadata as any;
			return (
				debt.status === "sent" || 
				debt.status === "awaiting_response" || 
				debt.status === "counter_negotiating"
			) && 
			metadata?.fromEmail === fromEmail && 
			metadata?.toEmail === toEmail;
		}).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

		// Return the most recent debt that matches
		return matchingDebts.length > 0 ? matchingDebts[0] : null;
	} catch (error) {
		console.error("Error in checkForExistingNegotiation:", error);
		return null;
	}
}

// Handle response to existing negotiation
async function handleNegotiationResponse(
	debt: any,
	emailData: any,
	appwriteAdmin: ReturnType<typeof createAppwriteAdmin>,
) {
	try {
		const textBody = emailData.TextBody || emailData.HtmlBody || "";
		const fromEmail = emailData.FromFull?.Email || emailData.From || "unknown";
		const subject = emailData.Subject || "";
		const messageId = emailData.MessageID || `inbound-${Date.now()}`;

		// First, record this message in the conversation
		await appwriteAdmin.databases.createDocument(
			DATABASE_ID,
			COLLECTIONS.CONVERSATION_MESSAGES,
			ID.unique(),
			{
				debt_id: debt.$id,
				message_type: "response_received",
				direction: "inbound",
				subject: subject,
				body: textBody,
				from_email: fromEmail,
				to_email: emailData.ToFull?.[0]?.Email || emailData.To || "",
				message_id: messageId,
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			}
		);

		// Update debt conversation tracking
		await appwriteAdmin.databases.updateDocument(
			DATABASE_ID,
			COLLECTIONS.DEBTS,
			debt.$id,
			{
				conversation_count: debt.conversation_count + 1,
				last_message_at: new Date().toISOString(),
				status: "counter_negotiating", // Temporary status while analyzing
				updated_at: new Date().toISOString()
			}
		);

		// Call the analyze-response function
		const appwriteEndpoint = process.env.PUBLIC_APPWRITE_ENDPOINT ||
			import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
		const appwriteProjectId = process.env.PUBLIC_APPWRITE_PROJECT_ID ||
			import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
		const appwriteApiKey = process.env.APPWRITE_API_KEY ||
			import.meta.env.APPWRITE_API_KEY;

		if (appwriteEndpoint && appwriteProjectId && appwriteApiKey) {
			const analyzeUrl = `${appwriteEndpoint}/functions/v1/analyze-response`;

			try {
				const response = await fetch(analyzeUrl, {
					method: "POST",
					headers: {
						"X-Appwrite-Project": appwriteProjectId,
						"X-Appwrite-Key": appwriteApiKey,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						debtId: debt.$id,
						fromEmail,
						subject,
						body: textBody,
						messageId: messageId,
					}),
				});

				if (response.ok) {
					const result = await response.json();
					console.log("Response analysis completed:", result);

					return new Response(
						JSON.stringify({
							success: true,
							message: "Negotiation response processed",
							analysis: result.analysis,
						}),
						{
							status: 200,
							headers: { "Content-Type": "application/json" },
						},
					);
				} else {
					console.error(
						"Error calling analyze-response function:",
						await response.text(),
					);
				}
			} catch (analyzeError) {
				console.error("Error calling analyze-response function:", analyzeError);
			}
		}

		// Fallback: just log the response and mark for manual review
		await appwriteAdmin.databases.createDocument(
			DATABASE_ID,
			COLLECTIONS.AUDIT_LOGS,
			ID.unique(),
			{
				debt_id: debt.$id,
				action: "response_received_fallback",
				details: {
					fromEmail,
					subject,
					bodyPreview: textBody.substring(0, 200),
					requiresManualReview: true,
				},
				created_at: new Date().toISOString()
			}
		);

		return new Response(
			JSON.stringify({ success: true, message: "Response logged" }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		);
	} catch (error) {
		console.error("Error handling negotiation response:", error);
		return new Response(
			JSON.stringify({ error: "Failed to process negotiation response" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
}

export const POST: APIRoute = async ({ request }) => {
	try {
		// Create admin client for webhook operations
		let appwriteAdmin;
		try {
			appwriteAdmin = createAppwriteAdmin();
		} catch (configError) {
			console.error("Appwrite admin configuration error:", configError);
			return new Response(
				JSON.stringify({ error: "Server configuration error" }),
				{
					status: 500,
					headers: { "Content-Type": "application/json" },
				},
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
		const userId = await getUserIdByEmail(toEmail, appwriteAdmin);
		if (!userId) {
			console.warn(`No user found for email: ${toEmail}`);
			return new Response("No matching user found", { status: 200 });
		}

		// Check if this is a response to an existing negotiation
		const existingDebt = await checkForExistingNegotiation(
			fromEmail,
			toEmail,
			appwriteAdmin,
		);

		console.log({ existingDebt, fromEmail, toEmail });
		if (existingDebt) {
			console.log(
				`Found existing negotiation for debt ${existingDebt.$id}, analyzing response...`,
			);
			return await handleNegotiationResponse(existingDebt, data, appwriteAdmin);
		}

		// Increment email processing usage
		await incrementEmailUsage(userId, appwriteAdmin);

		// Check for opt-out using AI
		const optOutDetection = await detectOptOutWithAI(textBody, fromEmail);
		let hasOptOut = false;

		if (optOutDetection) {
			hasOptOut = optOutDetection.isOptOut && optOutDetection.confidence > 0.7;
			console.log(
				`AI opt-out detection: ${hasOptOut} (confidence: ${optOutDetection.confidence})`,
			);
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
			try {
				await appwriteAdmin.databases.createDocument(
					DATABASE_ID,
					COLLECTIONS.DEBTS,
					ID.unique(),
					{
						user_id: userId,
						vendor: fromEmail,
						amount: 0,
						raw_email: textBody,
						status: "opted_out",
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					}
				);
			} catch (error) {
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
				},
			);
		}

		// Insert debt record with AI-extracted information
		let insertedDebt;
		try {
			insertedDebt = await appwriteAdmin.databases.createDocument(
				DATABASE_ID,
				COLLECTIONS.DEBTS,
				ID.unique(),
				{
					user_id: userId,
					vendor: debtInfo.vendor,
					amount: debtInfo.amount,
					raw_email: textBody,
					status: "received",
					description: debtInfo.description,
					due_date: debtInfo.dueDate,
					conversation_count: 1,
					last_message_at: new Date().toISOString(),
					negotiation_round: 1,
					projected_savings: 0,
					metadata: {
						isDebtCollection: debtInfo.isDebtCollection,
						subject: data.Subject,
						fromEmail: fromEmail,
						toEmail: toEmail,
					},
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				}
			);

			// Record the initial debt email as the first conversation message
			await appwriteAdmin.databases.createDocument(
				DATABASE_ID,
				COLLECTIONS.CONVERSATION_MESSAGES,
				ID.unique(),
				{
					debt_id: insertedDebt.$id,
					message_type: "initial_debt",
					direction: "inbound",
					subject: data.Subject,
					body: textBody,
					from_email: fromEmail,
					to_email: toEmail,
					message_id: data.MessageID || `initial-${Date.now()}`,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				}
			);
		} catch (insertError) {
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
				},
			);
		}

		// Log the email receipt
		await appwriteAdmin.databases.createDocument(
			DATABASE_ID,
			COLLECTIONS.AUDIT_LOGS,
			ID.unique(),
			{
				debt_id: insertedDebt.$id,
				action: "email_received",
				details: {
					vendor: debtInfo.vendor,
					amount: debtInfo.amount,
					subject: data.Subject,
					aiParsed: true,
				},
				created_at: new Date().toISOString(),
			}
		);

		// Trigger negotiation function if this is a legitimate debt
		if (debtInfo.amount > 0 && debtInfo.isDebtCollection) {
			// Access environment variables through Astro runtime
			const appwriteEndpoint = process.env.PUBLIC_APPWRITE_ENDPOINT ||
				import.meta.env.PUBLIC_APPWRITE_ENDPOINT;
			const appwriteProjectId = process.env.PUBLIC_APPWRITE_PROJECT_ID ||
				import.meta.env.PUBLIC_APPWRITE_PROJECT_ID;
			const appwriteApiKey = process.env.APPWRITE_API_KEY ||
				import.meta.env.APPWRITE_API_KEY;

			if (appwriteEndpoint && appwriteProjectId && appwriteApiKey) {
				const negotiateUrl = `${appwriteEndpoint}/functions/v1/negotiate`;

				try {
					await fetch(negotiateUrl, {
						method: "POST",
						headers: {
							"X-Appwrite-Project": appwriteProjectId,
							"X-Appwrite-Key": appwriteApiKey,
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
					"Appwrite environment variables not configured for negotiation trigger",
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
