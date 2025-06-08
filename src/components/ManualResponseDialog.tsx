import React, { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Separator } from "./ui/separator";
import {
	AlertCircle,
	Mail,
	Send,
	Eye,
	MessageSquare,
	Building2,
	User,
	Calendar,
} from "lucide-react";
import { supabase, type Debt } from "../lib/supabase";
import { toast } from "sonner";

interface ConversationMessage {
	id: string;
	debt_id: string;
	message_type: string;
	direction: "inbound" | "outbound";
	subject?: string;
	body: string;
	from_email?: string;
	to_email?: string;
	ai_analysis?: any;
	created_at: string;
}

interface ManualResponseDialogProps {
	debt: Debt;
	onResponseSent?: () => void;
}

export function ManualResponseDialog({
	debt,
	onResponseSent,
}: ManualResponseDialogProps) {
	const [open, setOpen] = useState(false);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [lastMessage, setLastMessage] = useState<ConversationMessage | null>(
		null
	);

	// Fetch the last inbound message when dialog opens
	useEffect(() => {
		if (open) {
			fetchLastInboundMessage();
			generateDefaultResponse();
		}
	}, [open, debt.id]);

	const fetchLastInboundMessage = async () => {
		try {
			const { data, error } = await supabase
				.from("conversation_messages")
				.select("*")
				.eq("debt_id", debt.id)
				.eq("direction", "inbound")
				.order("created_at", { ascending: false })
				.limit(1)
				.single();

			if (error) {
				console.error("Error fetching last message:", error);
				return;
			}

			setLastMessage(data);
		} catch (error) {
			console.error("Error fetching last message:", error);
		}
	};

	const generateDefaultResponse = () => {
		// Generate a default subject line
		const defaultSubject = `Re: ${
			debt.metadata?.subject || `Account ${debt.vendor}`
		}`;
		setSubject(defaultSubject);

		// Generate a basic template response
		const defaultBody = `Dear ${debt.vendor},

Thank you for your recent correspondence regarding this account.

I am writing to discuss the terms of this debt and explore options for resolution. I would like to work with you to find a mutually acceptable solution.

Please let me know what options are available for resolving this matter.

Thank you for your time and consideration.

Sincerely,
{{ Your Name }}`;

		setBody(defaultBody);
	};

	const handleSendResponse = async () => {
		if (!subject.trim() || !body.trim()) {
			toast.error("Please fill in both subject and message");
			return;
		}

		setIsSending(true);
		try {
			// Create conversation message
			const { error: messageError } = await supabase
				.from("conversation_messages")
				.insert({
					debt_id: debt.id,
					message_type: "manual_response",
					direction: "outbound",
					subject: subject.trim(),
					body: body.trim(),
					from_email: debt.metadata?.toEmail || "user@example.com",
					to_email: debt.metadata?.fromEmail || debt.vendor,
					message_id: `manual-${Date.now()}`,
				});

			if (messageError) {
				throw messageError;
			}

			// Update debt status
			const { error: debtError } = await supabase
				.from("debts")
				.update({
					status: "awaiting_response",
					last_message_at: new Date().toISOString(),
					conversation_count: (debt.conversation_count || 0) + 1,
				})
				.eq("id", debt.id);

			if (debtError) {
				throw debtError;
			}

			// Log the action
			await supabase.from("audit_logs").insert({
				debt_id: debt.id,
				action: "manual_response_sent",
				details: {
					subject: subject.trim(),
					bodyLength: body.trim().length,
					sentAt: new Date().toISOString(),
				},
			});

			toast.success("Response Sent", {
				description:
					"Your manual response has been recorded and the debt status updated.",
			});

			setOpen(false);
			onResponseSent?.();
		} catch (error) {
			console.error("Error sending manual response:", error);
			toast.error("Failed to send response", {
				description: "Please try again or contact support.",
			});
		} finally {
			setIsSending(false);
		}
	};

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="w-full">
					<MessageSquare className="h-4 w-4 mr-2" />
					Manual Response Required
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertCircle className="h-5 w-5 text-amber-500" />
						Manual Response Required
					</DialogTitle>
					<DialogDescription>
						The AI couldn't determine the creditor's intent clearly. Please
						review their response and compose a manual reply.
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{/* Left Column: Creditor's Last Response */}
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold mb-3">
								Creditor's Last Response
							</h3>
							{lastMessage ? (
								<Card>
									<CardHeader className="pb-3">
										<div className="flex items-center justify-between">
											<CardTitle className="text-sm font-medium">
												{lastMessage.subject || "No Subject"}
											</CardTitle>
											<Badge variant="outline" className="text-xs">
												{formatDate(lastMessage.created_at)}
											</Badge>
										</div>
										<div className="flex items-center gap-2 text-sm text-gray-600">
											<Building2 className="h-3 w-3" />
											<span>{lastMessage.from_email} → You</span>
										</div>
									</CardHeader>
									<CardContent>
										<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
											<p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
												{lastMessage.body}
											</p>
										</div>
										{lastMessage.ai_analysis && (
											<div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
												<div className="text-sm">
													<div className="font-medium text-amber-800 dark:text-amber-200 mb-1">
														AI Analysis
													</div>
													<div className="text-amber-700 dark:text-amber-300">
														Intent:{" "}
														{lastMessage.ai_analysis.intent || "unclear"}
														{lastMessage.ai_analysis.confidence && (
															<span className="ml-2">
																(
																{Math.round(
																	lastMessage.ai_analysis.confidence * 100
																)}
																% confidence)
															</span>
														)}
													</div>
													{lastMessage.ai_analysis.reasoning && (
														<div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
															{lastMessage.ai_analysis.reasoning}
														</div>
													)}
												</div>
											</div>
										)}
									</CardContent>
								</Card>
							) : (
								<div className="text-center py-8 text-gray-500">
									<Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
									<p>No recent creditor response found</p>
								</div>
							)}
						</div>
					</div>

					{/* Right Column: Compose Response */}
					<div className="space-y-4">
						<div>
							<h3 className="text-lg font-semibold mb-3">
								Compose Your Response
							</h3>
							<div className="space-y-4">
								<div>
									<Label htmlFor="subject">Subject Line</Label>
									<Input
										id="subject"
										value={subject}
										onChange={(e) => setSubject(e.target.value)}
										placeholder="Enter subject line..."
										className="mt-1"
									/>
								</div>

								<div>
									<Label htmlFor="body">Message Body</Label>
									<Textarea
										id="body"
										value={body}
										onChange={(e) => setBody(e.target.value)}
										placeholder="Compose your response..."
										className="mt-1 min-h-[300px]"
									/>
									<div className="text-xs text-gray-500 mt-1">
										{
											"Use {{ Your Name }} for placeholders that will be replaced with your actual information."
										}
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<Separator />

				<DialogFooter className="flex justify-between">
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={handleSendResponse} disabled={isSending}>
						{isSending ? (
							<>
								<Send className="h-4 w-4 mr-2 animate-pulse" />
								Sending...
							</>
						) : (
							<>
								<Send className="h-4 w-4 mr-2" />
								Send Response
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
