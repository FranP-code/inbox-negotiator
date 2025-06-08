import React, { useState, useEffect } from "react";
import {
	CheckCircle,
	Clock,
	AlertTriangle,
	XCircle,
	StopCircle,
	Send,
	MessageSquare,
	ThumbsUp,
	ThumbsDown,
	RefreshCw,
} from "lucide-react";
import type { Debt } from "../lib/supabase";
import { createClient } from "@supabase/supabase-js";

interface DebtTimelineProps {
	debt: Debt;
}

interface ConversationMessage {
	id: string;
	message_type: string;
	direction: "inbound" | "outbound";
	subject: string;
	body: string;
	from_email: string;
	to_email: string;
	ai_analysis?: any;
	created_at: string;
}

const getTimelineSteps = (debt: Debt) => {
	const baseSteps = [
		{ key: "received", label: "Debt Email Received", icon: MessageSquare },
		{ key: "negotiating", label: "AI Response Generated", icon: Clock },
		{ key: "approved", label: "Response Approved", icon: CheckCircle },
		{ key: "sent", label: "Negotiation Email Sent", icon: Send },
	];

	// Add dynamic steps based on conversation
	if (debt.status === "counter_negotiating" || debt.negotiation_round > 1) {
		baseSteps.push({
			key: "counter_negotiating",
			label: "Counter-Negotiating",
			icon: RefreshCw,
		});
	}

	if (debt.status === "accepted" || debt.status === "settled") {
		baseSteps.push({
			key: "accepted",
			label: "Offer Accepted",
			icon: ThumbsUp,
		});
		baseSteps.push({
			key: "settled",
			label: "Debt Settled",
			icon: CheckCircle,
		});
	} else if (debt.status === "rejected") {
		baseSteps.push({
			key: "rejected",
			label: "Offer Rejected",
			icon: ThumbsDown,
		});
	}

	return baseSteps;
};

const statusIcons = {
	received: MessageSquare,
	negotiating: Clock,
	approved: CheckCircle,
	sent: Send,
	awaiting_response: Clock,
	counter_negotiating: RefreshCw,
	requires_manual_review: AlertTriangle,
	accepted: ThumbsUp,
	rejected: ThumbsDown,
	settled: CheckCircle,
	failed: XCircle,
	opted_out: StopCircle,
};

const statusColors = {
	received: "text-blue-600 dark:text-blue-400",
	negotiating: "text-yellow-600 dark:text-yellow-400",
	approved: "text-green-600 dark:text-green-400",
	sent: "text-purple-600 dark:text-purple-400",
	awaiting_response: "text-orange-600 dark:text-orange-400",
	counter_negotiating: "text-indigo-600 dark:text-indigo-400",
	accepted: "text-green-600 dark:text-green-400",
	rejected: "text-red-600 dark:text-red-400",
	settled: "text-green-600 dark:text-green-400",
	failed: "text-red-600 dark:text-red-400",
	opted_out: "text-gray-600 dark:text-gray-400",
};

export function DebtTimeline({ debt }: DebtTimelineProps) {
	const [conversationMessages, setConversationMessages] = useState<
		ConversationMessage[]
	>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const fetchConversationMessages = async () => {
			try {
				const supabase = createClient(
					import.meta.env.PUBLIC_SUPABASE_URL,
					import.meta.env.PUBLIC_SUPABASE_ANON_KEY
				);

				const { data, error } = await supabase
					.from("conversation_messages")
					.select("*")
					.eq("debt_id", debt.id)
					.order("created_at", { ascending: true });

				if (error) {
					console.error("Error fetching conversation messages:", error);
				} else {
					setConversationMessages(data || []);
				}
			} catch (error) {
				console.error("Error:", error);
			} finally {
				setLoading(false);
			}
		};

		fetchConversationMessages();
	}, [debt.id]);

	const timelineSteps = getTimelineSteps(debt);
	const currentStepIndex = timelineSteps.findIndex(
		(step) => step.key === debt.status
	);

	const formatDateTime = (dateString: string) => {
		const date = new Date(dateString);
		return {
			date: date.toLocaleDateString(),
			time: date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
		};
	};

	const getStatusDescription = (status: string, round?: number) => {
		switch (status) {
			case "received":
				return "Debt collection email received and parsed";
			case "negotiating":
				return "AI analyzing debt and generating negotiation strategy";
			case "approved":
				return "Negotiation response approved and ready to send";
			case "sent":
				return "Negotiation email sent to creditor";
			case "awaiting_response":
				return "Waiting for creditor's response";
			case "counter_negotiating":
				return `Round ${round || 1} - Analyzing creditor's counter-offer`;
			case "accepted":
				return "Creditor accepted the negotiation terms";
			case "rejected":
				return "Creditor rejected the offer - manual review needed";
			case "settled":
				return "Debt successfully settled with agreed terms";
			case "failed":
				return "Negotiation failed - escalated for manual handling";
			default:
				return "Processing...";
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h3 className="text-lg font-semibold">Negotiation Timeline</h3>
				<div className="text-sm text-gray-500 dark:text-gray-400">
					Round {debt.negotiation_round || 1} • {debt.conversation_count || 0}{" "}
					messages
				</div>
			</div>

			{/* Current Status Overview */}
			<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
				<div className="flex items-center gap-3">
					<div
						className={`p-2 rounded-full ${statusColors[
							debt.status as keyof typeof statusColors
						]
							?.replace("text-", "bg-")
							.replace("dark:text-", "dark:bg-")} bg-opacity-20`}
					>
						{React.createElement(
							statusIcons[debt.status as keyof typeof statusIcons] || Clock,
							{
								className: `h-5 w-5 ${
									statusColors[debt.status as keyof typeof statusColors]
								}`,
							}
						)}
					</div>
					<div>
						<div className="font-medium capitalize">
							{debt.status.replace("_", " ")}
						</div>
						<div className="text-sm text-gray-600 dark:text-gray-300">
							{getStatusDescription(debt.status, debt.negotiation_round)}
						</div>
						{debt.last_message_at && (
							<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
								Last updated: {formatDateTime(debt.last_message_at).date} at{" "}
								{formatDateTime(debt.last_message_at).time}
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Timeline Steps */}
			<div className="space-y-4">
				{timelineSteps.map((step, index) => {
					const isCompleted = index <= currentStepIndex;
					const isActive = index === currentStepIndex;
					const Icon = step.icon;

					return (
						<div key={step.key} className="flex items-start gap-3">
							<div
								className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2 mt-1
                  ${
										isCompleted
											? "bg-primary border-primary text-white"
											: "border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600"
									}
                  ${isActive ? "ring-2 ring-primary/20" : ""}
                `}
							>
								<Icon className="h-4 w-4" />
							</div>

							<div className="flex-1 min-w-0">
								<div
									className={`
                    font-medium
                    ${
											isCompleted
												? "text-gray-900 dark:text-foreground"
												: "text-gray-400 dark:text-gray-500"
										}
                  `}
								>
									{step.label}
								</div>

								{isActive && (
									<div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
										{getStatusDescription(debt.status, debt.negotiation_round)}
									</div>
								)}
							</div>

							{isCompleted && debt.updated_at && (
								<div className="text-xs text-gray-500 dark:text-gray-400 text-right">
									<div>{formatDateTime(debt.updated_at).date}</div>
									<div>{formatDateTime(debt.updated_at).time}</div>
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* Conversation Messages */}
			{!loading && conversationMessages.length > 0 && (
				<div className="space-y-4">
					<h4 className="text-md font-medium text-gray-700 dark:text-gray-300">
						Conversation History
					</h4>
					<div className="space-y-3">
						{conversationMessages.map((message) => {
							const isOutbound = message.direction === "outbound";
							const datetime = formatDateTime(message.created_at);

							return (
								<div
									key={message.id}
									className={`flex ${
										isOutbound ? "justify-end" : "justify-start"
									}`}
								>
									<div
										className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
											isOutbound
												? "bg-primary text-white"
												: "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
										}`}
									>
										<div className="text-xs opacity-75 mb-1">
											{isOutbound ? "You" : "Creditor"} • {datetime.date}{" "}
											{datetime.time}
										</div>
										<div className="text-sm font-medium mb-1">
											{message.subject}
										</div>
										<div className="text-sm opacity-90">
											{message.body.length > 100
												? `${message.body.substring(0, 100)}...`
												: message.body}
										</div>
										{message.ai_analysis && (
											<div className="text-xs mt-2 opacity-75">
												AI: {message.ai_analysis.intent || "Analyzed"}
												{message.ai_analysis.confidence &&
													` (${Math.round(
														message.ai_analysis.confidence * 100
													)}% confidence)`}
											</div>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			)}

			{/* Savings Summary */}
			{(debt.projected_savings > 0 ||
				(debt.actual_savings && debt.actual_savings > 0)) && (
				<div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
					<h4 className="text-md font-medium text-green-800 dark:text-green-200 mb-2">
						Savings Summary
					</h4>
					<div className="grid grid-cols-2 gap-4 text-sm">
						{debt.projected_savings > 0 && (
							<div>
								<div className="text-green-600 dark:text-green-400 font-medium">
									Projected Savings
								</div>
								<div className="text-green-800 dark:text-green-200">
									${debt.projected_savings.toFixed(2)}
								</div>
							</div>
						)}
						{debt.actual_savings && debt.actual_savings > 0 && (
							<div>
								<div className="text-green-600 dark:text-green-400 font-medium">
									Actual Savings
								</div>
								<div className="text-green-800 dark:text-green-200">
									${debt.actual_savings.toFixed(2)}
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
