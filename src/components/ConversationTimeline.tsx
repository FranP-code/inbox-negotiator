import React, { useEffect, useState } from "react";
import {
	CheckCircle,
	Clock,
	AlertCircle,
	XCircle,
	StopCircle,
	Mail,
	MailOpen,
	MessageSquare,
	TrendingUp,
	TrendingDown,
	Calendar,
	User,
	Building2,
} from "lucide-react";
import { supabase, type Debt } from "../lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { toast } from "sonner";
import { formatCurrency } from "../lib/utils";

interface ConversationMessage {
	id: string;
	debt_id: string;
	message_type: string;
	direction: "inbound" | "outbound";
	subject?: string;
	body: string;
	from_email?: string;
	to_email?: string;
	message_id?: string;
	ai_analysis?: any;
	created_at: string;
	updated_at: string;
}

interface ConversationTimelineProps {
	debt: Debt;
	onDebtUpdate?: (updatedDebt: Debt) => void;
}

const messageTypeLabels = {
	initial_debt: "Initial Debt Notice",
	negotiation_sent: "Negotiation Sent",
	response_received: "Response Received",
	counter_offer: "Counter Offer",
	acceptance: "Offer Accepted",
	rejection: "Offer Rejected",
	manual_response: "Manual Response",
};

const statusColors = {
	received: "text-blue-600 dark:text-blue-400",
	negotiating: "text-yellow-600 dark:text-yellow-400",
	approved: "text-purple-600 dark:text-purple-400",
	sent: "text-orange-600 dark:text-orange-400",
	awaiting_response: "text-blue-600 dark:text-blue-400",
	counter_negotiating: "text-yellow-600 dark:text-yellow-400",
	requires_manual_review: "text-amber-600 dark:text-amber-400",
	accepted: "text-green-600 dark:text-green-400",
	rejected: "text-red-600 dark:text-red-400",
	settled: "text-green-600 dark:text-green-400",
	failed: "text-red-600 dark:text-red-400",
	opted_out: "text-gray-600 dark:text-gray-400",
};

const statusLabels = {
	received: "Received",
	negotiating: "Negotiating",
	approved: "Approved",
	sent: "Sent",
	awaiting_response: "Awaiting Response",
	counter_negotiating: "Counter Negotiating",
	requires_manual_review: "Manual Review Required",
	accepted: "Accepted",
	rejected: "Rejected",
	settled: "Settled",
	failed: "Failed",
	opted_out: "Opted Out",
};

export function ConversationTimeline({
	debt,
	onDebtUpdate,
}: ConversationTimelineProps) {
	const [messages, setMessages] = useState<ConversationMessage[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetchConversationMessages();

		// Set up real-time subscription for conversation messages
		const channel = supabase
			.channel(`conversation_messages:debt_id=eq.${debt.id}`)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "conversation_messages",
					filter: `debt_id=eq.${debt.id}`,
				},
				(payload) => {
					console.log("Real-time conversation message update:", payload);

					if (payload.eventType === "INSERT") {
						// Add new message to the list
						const newMessage = payload.new as ConversationMessage;
						setMessages((prev) => [...prev, newMessage]);

						// Show toast notification for new messages
						if (newMessage.direction === "inbound") {
							const isAcceptance = newMessage.message_type === "acceptance";
							toast.success(
								isAcceptance ? "🎉 Offer Accepted!" : "New Response Received",
								{
									description: isAcceptance
										? "Creditor accepted your negotiation offer!"
										: `${
												messageTypeLabels[newMessage.message_type] ||
												"New message"
										  } from creditor`,
								}
							);
						}
					} else if (payload.eventType === "UPDATE") {
						// Update existing message
						setMessages((prev) =>
							prev.map((msg) =>
								msg.id === payload.new.id
									? (payload.new as ConversationMessage)
									: msg
							)
						);
					} else if (payload.eventType === "DELETE") {
						// Remove deleted message
						setMessages((prev) =>
							prev.filter((msg) => msg.id !== payload.old.id)
						);
					}
				}
			)
			.subscribe();

		// Set up real-time subscription for debt status changes
		const debtChannel = supabase
			.channel(`debt_status:id=eq.${debt.id}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "debts",
					filter: `id=eq.${debt.id}`,
				},
				(payload) => {
					console.log("Real-time debt status update:", payload);
					// Notify parent component about debt update
					if (onDebtUpdate) {
						onDebtUpdate(payload.new as Debt);
					}
				}
			)
			.subscribe();

		// Cleanup subscriptions on unmount
		return () => {
			supabase.removeChannel(channel);
			supabase.removeChannel(debtChannel);
		};
	}, [debt.id]);

	const fetchConversationMessages = async () => {
		try {
			const { data, error } = await supabase
				.from("conversation_messages")
				.select("*")
				.eq("debt_id", debt.id)
				.order("created_at", { ascending: true });

			if (error) {
				console.error("Error fetching conversation messages:", error);
				return;
			}

			setMessages(data || []);
		} catch (error) {
			console.error("Error fetching conversation messages:", error);
		} finally {
			setLoading(false);
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

	const getMessageIcon = (message: ConversationMessage) => {
		if (message.direction === "outbound") {
			return <Mail className="h-4 w-4" />;
		} else {
			switch (message.message_type) {
				case "acceptance":
					return <CheckCircle className="h-4 w-4" />;
				case "rejection":
					return <XCircle className="h-4 w-4" />;
				case "counter_offer":
					return <MessageSquare className="h-4 w-4" />;
				default:
					return <MailOpen className="h-4 w-4" />;
			}
		}
	};

	const getMessageColor = (message: ConversationMessage) => {
		if (message.direction === "outbound") {
			return "text-blue-600 dark:text-blue-400";
		} else {
			switch (message.message_type) {
				case "acceptance":
					return "text-green-600 dark:text-green-400";
				case "rejection":
					return "text-red-600 dark:text-red-400";
				case "counter_offer":
					return "text-yellow-600 dark:text-yellow-400";
				default:
					return "text-gray-600 dark:text-gray-400";
			}
		}
	};

	const getSentimentIcon = (sentiment?: string) => {
		switch (sentiment) {
			case "positive":
				return <TrendingUp className="h-3 w-3 text-green-500" />;
			case "negative":
				return <TrendingDown className="h-3 w-3 text-red-500" />;
			default:
				return null;
		}
	};

	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5 animate-spin" />
						Loading Conversation...
					</CardTitle>
				</CardHeader>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<MessageSquare className="h-5 w-5" />
						Conversation Timeline
					</div>
					<div className="flex items-center gap-2">
						<Badge variant="outline" className={statusColors[debt.status]}>
							{statusLabels[debt.status]}
						</Badge>
						<span className="text-sm text-gray-500">
							Round {debt.negotiation_round || 1}
						</span>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{messages.length === 0 ? (
					<div className="text-center py-8 text-gray-500 dark:text-gray-400">
						<MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
						<p>No conversation messages yet</p>
						<p className="text-sm">
							Messages will appear here as the negotiation progresses
						</p>
					</div>
				) : (
					<div className="space-y-4">
						{messages.map((message, index) => (
							<div key={message.id} className="relative">
								{/* Timeline line */}
								{index < messages.length - 1 && (
									<div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />
								)}

								<div className="flex gap-4">
									{/* Icon */}
									<div
										className={`
                      flex items-center justify-center w-8 h-8 rounded-full border-2 bg-white dark:bg-gray-800
                      ${getMessageColor(message)} border-current
                    `}
									>
										{getMessageIcon(message)}
									</div>

									{/* Content */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between mb-2">
											<div className="flex items-center gap-2">
												<h4 className="font-medium text-gray-900 dark:text-foreground">
													{messageTypeLabels[message.message_type] ||
														message.message_type}
												</h4>
												{message.ai_analysis?.sentiment &&
													getSentimentIcon(message.ai_analysis.sentiment)}
											</div>
											<div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
												<Calendar className="h-3 w-3" />
												{formatDate(message.created_at)}
											</div>
										</div>

										<div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 mb-2">
											{message.direction === "outbound" ? (
												<>
													<User className="h-3 w-3" />
													<span>You → {message.to_email}</span>
												</>
											) : (
												<>
													<Building2 className="h-3 w-3" />
													<span>{message.from_email} → You</span>
												</>
											)}
										</div>

										{message.subject && (
											<p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
												Subject: {message.subject}
											</p>
										)}

										<div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
											<p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
												{message.body.length > 200
													? `${message.body.substring(0, 200)}...`
													: message.body}
											</p>
										</div>

										{/* AI Analysis */}
										{message.ai_analysis && (
											<div className="mt-2 space-y-2">
												{message.ai_analysis.intent && (
													<div className="flex items-center gap-2 my-2">
														<Badge
															variant={
																message.ai_analysis.intent === "acceptance"
																	? "default"
																	: "secondary"
															}
															className={`text-xs ${
																message.ai_analysis.intent === "acceptance"
																	? "bg-green-600 text-white"
																	: ""
															}`}
														>
															Intent: {message.ai_analysis.intent}
														</Badge>
														{message.ai_analysis.confidence && (
															<span className="text-xs text-gray-500">
																{Math.round(
																	message.ai_analysis.confidence * 100
																)}
																% confidence
															</span>
														)}
													</div>
												)}

												{!!message.ai_analysis.extractedTerms
													?.proposedAmount && (
													<div className="text-xs text-gray-600 dark:text-gray-400">
														Proposed Amount: $
														{formatCurrency(
															message.ai_analysis.extractedTerms.proposedAmount
														)}
													</div>
												)}

												{/* Show financial outcome for accepted offers */}
												{message.ai_analysis.intent === "acceptance" &&
													debt.metadata?.financialOutcome && (
														<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mt-2">
															{debt.metadata.financialOutcome.financialBenefit
																?.type === "principal_reduction" ? (
																<>
																	<div className="flex items-center gap-2 mb-2">
																		<TrendingUp className="h-4 w-4 text-green-600" />
																		<span className="font-medium text-green-800 dark:text-green-200">
																			Principal Reduction Achieved
																		</span>
																	</div>
																	<div className="grid grid-cols-2 gap-2 text-xs">
																		<div>
																			<span className="text-gray-600 dark:text-gray-400">
																				Original Debt:
																			</span>
																			<div className="font-medium">
																				$
																				{
																					debt.metadata.financialOutcome
																						.originalAmount
																				}
																			</div>
																		</div>
																		<div>
																			<span className="text-gray-600 dark:text-gray-400">
																				Settlement Amount:
																			</span>
																			<div className="font-medium">
																				$
																				{
																					debt.metadata.financialOutcome
																						.acceptedAmount
																				}
																			</div>
																		</div>
																		<div>
																			<span className="text-gray-600 dark:text-gray-400">
																				Total Savings:
																			</span>
																			<div className="font-medium text-green-600">
																				$
																				{
																					debt.metadata.financialOutcome
																						.actualSavings
																				}
																			</div>
																		</div>
																		<div>
																			<span className="text-gray-600 dark:text-gray-400">
																				Reduction:
																			</span>
																			<div className="font-medium text-green-600">
																				{
																					debt.metadata.financialOutcome
																						.financialBenefit.percentage
																				}
																				%
																			</div>
																		</div>
																	</div>
																</>
															) : debt.metadata.financialOutcome
																	.financialBenefit?.type ===
															  "payment_restructuring" ? (
																<>
																	<div className="flex items-center gap-2 mb-2">
																		<Calendar className="h-4 w-4 text-blue-600" />
																		<span className="font-medium text-blue-800 dark:text-blue-200">
																			Payment Plan Restructured
																		</span>
																	</div>
																	<div className="space-y-2 text-xs">
																		<div className="bg-blue-50 dark:bg-blue-900/30 rounded p-2">
																			<div className="font-medium text-blue-800 dark:text-blue-200 mb-1">
																				{
																					debt.metadata.financialOutcome
																						.financialBenefit.description
																				}
																			</div>
																			{debt.metadata.financialOutcome
																				.financialBenefit.cashFlowBenefit && (
																				<div className="text-blue-600 dark:text-blue-300">
																					💰{" "}
																					{
																						debt.metadata.financialOutcome
																							.financialBenefit.cashFlowBenefit
																					}
																				</div>
																			)}
																		</div>
																		{debt.metadata.financialOutcome
																			.paymentStructure && (
																			<div className="grid grid-cols-2 gap-2">
																				<div>
																					<span className="text-gray-600 dark:text-gray-400">
																						Monthly Payment:
																					</span>
																					<div className="font-medium">
																						$
																						{
																							debt.metadata.financialOutcome
																								.paymentStructure.monthlyAmount
																						}
																					</div>
																				</div>
																				<div>
																					<span className="text-gray-600 dark:text-gray-400">
																						Term Length:
																					</span>
																					<div className="font-medium">
																						{
																							debt.metadata.financialOutcome
																								.paymentStructure
																								.numberOfPayments
																						}{" "}
																						months
																					</div>
																				</div>
																				<div>
																					<span className="text-gray-600 dark:text-gray-400">
																						Total Amount:
																					</span>
																					<div className="font-medium">
																						$
																						{formatCurrency(
																							debt.metadata.financialOutcome
																								.paymentStructure.totalAmount
																						)}
																					</div>
																				</div>
																				<div>
																					<span className="text-gray-600 dark:text-gray-400">
																						Frequency:
																					</span>
																					<div className="font-medium capitalize">
																						{
																							debt.metadata.financialOutcome
																								.paymentStructure.frequency
																						}
																					</div>
																				</div>
																			</div>
																		)}
																	</div>
																</>
															) : (
																<>
																	<div className="flex items-center gap-2 mb-2">
																		<CheckCircle className="h-4 w-4 text-green-600" />
																		<span className="font-medium text-green-800 dark:text-green-200">
																			Offer Accepted
																		</span>
																	</div>
																	<div className="text-xs text-gray-600 dark:text-gray-400">
																		Settlement terms have been agreed upon.
																	</div>
																</>
															)}
														</div>
													)}
											</div>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				)}

				<Separator className="my-4" />

				{/* Summary */}
				<div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
					<div className="flex items-center justify-between text-sm">
						<div className="flex items-center gap-4">
							<span className="text-gray-600 dark:text-gray-300">
								Total Messages: {messages.length}
							</span>
							<span className="text-gray-600 dark:text-gray-300">
								Negotiation Round: {debt.negotiation_round || 1}
							</span>
						</div>
						{debt.last_message_at && (
							<span className="text-gray-500 dark:text-gray-400">
								Last Activity: {formatDate(debt.last_message_at)}
							</span>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
