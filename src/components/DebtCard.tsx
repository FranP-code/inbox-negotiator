import React, { useState, useEffect } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "./ui/alert-dialog";
import {
	Calendar,
	DollarSign,
	Mail,
	FileText,
	TrendingUp,
	Edit3,
	CheckCircle,
	XCircle,
	AlertCircle,
	ExternalLink,
	Eye,
} from "lucide-react";
import { supabase, type Debt, type DebtVariable } from "../lib/supabase";
import { toast } from "sonner";
import { formatCurrency } from "../lib/utils";
import {
	replaceVariables,
	saveVariablesToDatabase,
	getVariablesForTemplate,
	updateVariablesForTextChange,
} from "../lib/emailVariables";
import { ManualResponseDialog } from "./ManualResponseDialog";
import { ConversationTimeline } from "./ConversationTimeline";

interface DebtCardProps {
	debt: Debt;
	onUpdate?: () => void; // Callback to refresh data after updates
	debts: Debt[];
	setDebts: (debts: Debt[]) => void;
}

const statusColors = {
	received:
		"bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
	negotiating:
		"bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
	approved:
		"bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/20 dark:text-teal-300 dark:border-teal-800",
	sent: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800",
	awaiting_response:
		"bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
	counter_negotiating:
		"bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
	requires_manual_review:
		"bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
	accepted:
		"bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
	rejected:
		"bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
	settled:
		"bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
	failed:
		"bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
	opted_out:
		"bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/20 dark:text-gray-300 dark:border-gray-700",
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

export function DebtCard({ debt, onUpdate, debts, setDebts }: DebtCardProps) {
	const [isApproving, setIsApproving] = useState(false);
	const [isRejecting, setIsRejecting] = useState(false);
	const [userProfile, setUserProfile] = useState<any>(null);
	const [hasServerToken, setHasServerToken] = useState<boolean | undefined>(
		undefined
	);

	const isReadOnly =
		debt.status === "approved" ||
		debt.status === "sent" ||
		debt.status === "awaiting_response" ||
		debt.status === "accepted" ||
		debt.status === "rejected" ||
		debt.status === "settled" ||
		debt.status === "failed" ||
		debt.status === "opted_out";

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const EditableResponseDialog = () => {
		const [isEditing, setIsEditing] = useState(false);
		const [isSaving, setIsSaving] = useState(false);
		const [subject, setSubject] = useState("");
		const [body, setBody] = useState("");
		const [variables, setVariables] = useState<Record<string, string>>({});

		// Check if debt is in read-only state (approved or sent)

		// Initialize data when dialog opens
		useEffect(() => {
			const initializeData = async () => {
				if (debt.metadata?.aiEmail) {
					const aiEmail = debt.metadata.aiEmail;
					setSubject(aiEmail.subject || "");
					setBody(aiEmail.body || "");

					// Get variables for the template using the modular function
					const initialVariables = await getVariablesForTemplate(
						debt.id,
						aiEmail.subject || "",
						aiEmail.body || ""
					);

					setVariables(initialVariables);
				}
			};

			initializeData();
		}, [debt.metadata?.aiEmail]);

		// Update variables when body changes
		const handleBodyChange = (newBody: string) => {
			setBody(newBody);
			// Update variables using the modular function
			const updatedVariables = updateVariablesForTextChange(
				variables,
				newBody,
				subject
			);
			setVariables(updatedVariables);
		};

		// Update variables when subject changes
		const handleSubjectChange = (newSubject: string) => {
			setSubject(newSubject);
			// Update variables using the modular function
			const updatedVariables = updateVariablesForTextChange(
				variables,
				newSubject,
				body
			);
			setVariables(updatedVariables);
		};

		// Update variables only (don't modify the text)
		const handleVariableChange = (variableName: string, value: string) => {
			const newVariables = { ...variables, [variableName]: value };
			setVariables(newVariables);
		};

		// Get display text for subject (for preview in input)
		const getSubjectDisplay = () => {
			return replaceVariables(subject, variables);
		};

		// Get display text for body (for preview in textarea)
		const getBodyDisplay = () => {
			return replaceVariables(body, variables);
		};

		// Save changes to database
		const handleSave = async () => {
			setIsSaving(true);
			try {
				// Update the metadata with the new subject and body
				const updatedMetadata = {
					...debt.metadata,
					aiEmail: {
						...debt.metadata?.aiEmail,
						subject,
						body,
					},
				};

				const { error } = await supabase
					.from("debts")
					.update({ metadata: updatedMetadata })
					.eq("id", debt.id);

				if (error) {
					console.error("Error saving debt metadata:", error);
					toast.error("Error", {
						description: "Failed to save email changes. Please try again.",
					});
					return;
				}

				// Save variables to database
				await saveVariablesToDatabase(debt.id, variables);

				toast.success("Changes saved", {
					description:
						"Your email and variables have been updated successfully.",
				});

				// Call onUpdate callback to refresh the parent component
				if (onUpdate) {
					onUpdate();
				}

				setIsEditing(false);
			} catch (error) {
				console.error("Error saving changes:", error);
				toast.error("Error", {
					description: "Failed to save changes. Please try again.",
				});
			} finally {
				setIsSaving(false);
			}
		};

		if (!debt.metadata?.aiEmail) return null;

		return (
			<Dialog>
				<DialogTrigger asChild>
					<Button variant="outline" size="sm" className="flex-1">
						{isReadOnly ? (
							<Eye className="h-4 w-4 mr-2" />
						) : (
							<Edit3 className="h-4 w-4 mr-2" />
						)}
						{isReadOnly ? "See Response" : "Edit Response"}
					</Button>
				</DialogTrigger>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>
							{isReadOnly
								? "View Negotiation Response"
								: "Edit Negotiation Response"}
						</DialogTitle>
						<DialogDescription>
							{isReadOnly
								? "Review your FDCPA-compliant response"
								: "Customize your FDCPA-compliant response before sending"}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-6 mt-4">
						{/* Variables Form */}
						{Object.keys(variables).length > 0 && (
							<div className="space-y-4">
								<div className="border-t pt-4">
									<Label className="text-base font-semibold">
										Fill in Variables
									</Label>
									<p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
										Complete the placeholders below to personalize your message
									</p>
								</div>

								<div className="grid gap-4 md:grid-cols-2">
									{Object.entries(variables).map(([variableName, value]) => (
										<div key={variableName} className="space-y-2">
											<Label
												htmlFor={`var-${variableName}`}
												className="text-sm"
											>
												{variableName}
											</Label>
											<Input
												id={`var-${variableName}`}
												value={value}
												onChange={(e) =>
													!isReadOnly &&
													handleVariableChange(variableName, e.target.value)
												}
												placeholder={`Enter ${variableName.toLowerCase()}`}
												className="w-full"
												readOnly={isReadOnly}
											/>
										</div>
									))}
								</div>
							</div>
						)}

						{/* Divider */}
						<div className="border-t pt-4" />

						{/* Subject Line */}
						<div className="space-y-2">
							<Label htmlFor="subject">Subject Line</Label>
							<Input
								id="subject"
								value={subject}
								onChange={(e) =>
									!isReadOnly && handleSubjectChange(e.target.value)
								}
								placeholder="Enter email subject (use {{ Variable Name }} for placeholders)"
								className="w-full"
								readOnly={isReadOnly}
							/>
							{/* Preview of subject with variables replaced */}
							{Object.keys(variables).length > 0 && (
								<div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-2 rounded border">
									<strong>Preview:</strong> {getSubjectDisplay()}
								</div>
							)}
						</div>

						{/* Body */}
						<div className="space-y-2">
							<Label htmlFor="body">Email Body</Label>
							<Textarea
								id="body"
								value={body}
								onChange={(e) =>
									!isReadOnly && handleBodyChange(e.target.value)
								}
								placeholder="Enter email body (use {{ Variable Name }} for placeholders)"
								className="w-full min-h-[300px] font-mono text-sm"
								readOnly={isReadOnly}
							/>
							{/* Preview of body with variables replaced */}
							{Object.keys(variables).length > 0 && (
								<div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded border">
									<strong>Preview:</strong>
									<pre className="whitespace-pre-wrap mt-2 font-mono text-xs">
										{getBodyDisplay()}
									</pre>
								</div>
							)}
						</div>

						{/* Action Buttons */}
						{!isReadOnly && (
							<div className="flex justify-end gap-2 border-t pt-4">
								<DialogClose>
									<Button variant="outline" onClick={() => setIsEditing(false)}>
										Cancel
									</Button>
								</DialogClose>
								<Button onClick={handleSave} disabled={isSaving}>
									{isSaving ? "Saving..." : "Save Changes"}
								</Button>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		);
	};

	// Check if user has server token configured
	useEffect(() => {
		checkServerToken();
	}, []);

	const checkServerToken = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			const { data: profile } = await supabase
				.from("user_profiles")
				.select("postmark_server_token")
				.eq("user_id", user.id)
				.single();

			setUserProfile(profile);
			setHasServerToken(!!profile?.postmark_server_token);
		} catch (error) {
			console.error("Error checking server token:", error);
		}
	};

	// Handle approve action
	const handleApprove = async (sendEmail = true) => {
		if (!hasServerToken && sendEmail) {
			toast.error("Server Token Required", {
				description:
					"Please configure your Postmark server token in settings first.",
			});
			return;
		}

		setIsApproving(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) throw new Error("User not authenticated");

			if (sendEmail) {
				// Call the send-email function
				const { data, error } = await supabase.functions.invoke("send-email", {
					body: {
						debtId: debt.id,
					},
				});

				if (error) throw error;

				if (data.requiresConfiguration) {
					toast.error("Configuration Required", {
						description:
							"Please set up your Postmark server token in configuration.",
					});
					return;
				}

				toast.success("Email Sent Successfully", {
					description: `Negotiation email sent to ${data.sentTo}`,
				});
			} else {
				// Call the approve-debt function to handle approval without sending email
				const { data, error } = await supabase.functions.invoke(
					"approve-debt",
					{
						body: {
							debtId: debt.id,
							approvalNote: "Approved by user without sending email",
						},
					}
				);

				if (error) throw error;

				toast.success("Debt Approved", {
					description: `Negotiation for ${data.vendor} has been approved and saved.`,
				});
			}

			// Refresh the data
			if (onUpdate) onUpdate();
		} catch (error: any) {
			console.error("Error in approval process:", error);
			const action = sendEmail ? "send email" : "approve debt";
			toast.error(`Failed to ${action}`, {
				description:
					error.message || `An error occurred while trying to ${action}.`,
			});
		} finally {
			setIsApproving(false);
		}
	};

	// Handle reject action
	const handleReject = async () => {
		setIsRejecting(true);
		try {
			const { error } = await supabase
				.from("debts")
				.update({
					status: "opted_out",
					metadata: {
						...debt.metadata,
						rejected: {
							rejectedAt: new Date().toISOString(),
							reason: "User rejected negotiation",
						},
					},
				})
				.eq("id", debt.id);

			if (error) throw error;

			// Log the action
			await supabase.from("audit_logs").insert({
				debt_id: debt.id,
				action: "negotiation_rejected",
				details: {
					rejectedAt: new Date().toISOString(),
					reason: "User rejected negotiation",
				},
			});

			toast.success("Negotiation Rejected", {
				description: "The negotiation has been marked as rejected.",
			});

			// Refresh the data
			if (onUpdate) onUpdate();
		} catch (error: any) {
			console.error("Error rejecting negotiation:", error);
			toast.error("Failed to Reject", {
				description:
					error.message || "An error occurred while rejecting the negotiation.",
			});
		} finally {
			setIsRejecting(false);
		}
	};

	// Check if approve button should be enabled
	const canApprove = (sendEmail = true) => {
		if (sendEmail) {
			return (
				debt.metadata?.aiEmail &&
				debt.status === "negotiating" &&
				hasServerToken
			);
		} else {
			return debt.metadata?.aiEmail && debt.status === "negotiating";
		}
	};

	// Check if buttons should be shown
	const showApproveRejectButtons = () => {
		return debt.metadata?.aiEmail && debt.status === "negotiating";
	};

	return (
		<Card className="w-full hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary">
			<CardHeader className="pb-3">
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg font-semibold text-gray-900 dark:text-foreground">
						{debt.vendor}
					</CardTitle>
					<Badge
						variant="outline"
						className={`${statusColors[debt.status]} font-medium`}
					>
						{statusLabels[debt.status]}
					</Badge>
				</div>
				<CardDescription className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
					<Calendar className="h-4 w-4" />
					{formatDate(debt.created_at)}
				</CardDescription>
			</CardHeader>

			<CardContent className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-0.5">
						<DollarSign className="h-5 w-5 text-gray-500 dark:text-gray-400 my-auto" />
						<span className="text-2xl font-bold text-gray-900 dark:text-foreground">
							{formatCurrency(debt.amount)}
						</span>
					</div>

					{debt.projected_savings > 0 && (
						<div className="flex items-center gap-1 text-green-600 dark:text-green-400">
							<TrendingUp className="h-4 w-4" />
							<span className="text-sm font-medium">
								Save {formatCurrency(debt.projected_savings)}
							</span>
						</div>
					)}
				</div>

				<div className="space-y-3">
					<div className="flex gap-2">
						<Dialog>
							<DialogTrigger asChild>
								<Button variant="outline" size="sm" className="flex-1">
									<Mail className="h-4 w-4 mr-2" />
									View Email
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>Original Email</DialogTitle>
									<DialogDescription>
										From: {debt.vendor} • {formatDate(debt.created_at)}
									</DialogDescription>
								</DialogHeader>
								<div className="mt-4">
									<pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
										{debt.raw_email || "No email content available"}
									</pre>
								</div>
							</DialogContent>
						</Dialog>

						{debt.metadata?.aiEmail && <EditableResponseDialog />}
					</div>

					{/* Manual Response Dialog - show when requires manual review */}
					{debt.status === "requires_manual_review" && (
						<ManualResponseDialog debt={debt} onResponseSent={onUpdate} />
					)}

					{/* Approve/Reject Buttons */}
					{showApproveRejectButtons() && (
						<div className="space-y-2">
							{hasServerToken === false && (
								<div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
									<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
									<span className="text-sm text-amber-700 dark:text-amber-300 flex-1">
										Configure your Postmark server token to enable email
										sending.
									</span>
									<Button
										variant="outline"
										size="sm"
										onClick={() => (window.location.href = "/configuration")}
										className="text-amber-700 dark:text-amber-500 border-amber-300"
									>
										<ExternalLink className="h-3 w-3 mr-1" />
										Settings
									</Button>
								</div>
							)}

							<div className="flex gap-2">
								<AlertDialog>
									<AlertDialogTrigger asChild>
										<Button
											variant="default"
											size="sm"
											className="flex-1 bg-green-600 hover:bg-green-700 text-white"
											disabled={!canApprove(true) || isApproving}
										>
											<CheckCircle className="h-4 w-4 mr-2" />
											{isApproving ? "Sending..." : "Approve & Send"}
										</Button>
									</AlertDialogTrigger>
									<AlertDialogContent>
										<AlertDialogHeader>
											<AlertDialogTitle>
												Send Negotiation Email
											</AlertDialogTitle>
											<AlertDialogDescription>
												This will send the approved negotiation email to{" "}
												{debt.vendor}. Make sure you have reviewed and are
												satisfied with the email content.
											</AlertDialogDescription>
										</AlertDialogHeader>
										<AlertDialogFooter>
											<AlertDialogCancel>Cancel</AlertDialogCancel>
											<AlertDialogAction
												onClick={() => handleApprove()}
												className="bg-green-600 hover:bg-green-700 text-white"
											>
												Send Email
											</AlertDialogAction>
										</AlertDialogFooter>
									</AlertDialogContent>
								</AlertDialog>
								<Button
									variant="outline"
									className="flex-1"
									onClick={() => handleApprove(false)}
									disabled={isApproving || isRejecting || !canApprove(false)}
								>
									<CheckCircle className="h-4 w-4 mr-2" />
									Approve
								</Button>
							</div>
						</div>
					)}
				</div>

				{/* Reject Button - only show if debt is not approved or sent */}
				{!isReadOnly && (
					<div className="flex justify-end gap-2">
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button
									variant="destructive"
									size="sm"
									className="flex-1"
									disabled={isRejecting}
								>
									<XCircle className="h-4 w-4 mr-2" />
									{isRejecting ? "Rejecting..." : "Reject"}
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Reject Negotiation</AlertDialogTitle>
									<AlertDialogDescription>
										This will mark the negotiation as rejected and opt you out
										of this debt collection process. This action cannot be
										undone.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={handleReject}
										className="bg-red-600 hover:bg-red-700"
									>
										Reject
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				)}

				<ConversationTimeline
					debt={debt}
					onDebtUpdate={(debt) => {
						setDebts(debts.map((d) => (d.id === debt.id ? debt : d)));
					}}
				/>
			</CardContent>
		</Card>
	);
}
