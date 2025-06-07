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
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./ui/dialog";
import {
	Calendar,
	DollarSign,
	Mail,
	FileText,
	TrendingUp,
	Edit3,
} from "lucide-react";
import { supabase, type Debt, type DebtVariable } from "../lib/supabase";
import { toast } from "../hooks/use-toast";

interface DebtCardProps {
	debt: Debt;
	onUpdate?: () => void; // Callback to refresh data after updates
}

const statusColors = {
	received:
		"bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
	negotiating:
		"bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-300 dark:border-yellow-800",
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
	settled: "Settled",
	failed: "Failed",
	opted_out: "Opted Out",
};

export function DebtCard({ debt, onUpdate }: DebtCardProps) {
	const formatCurrency = (amount: number) => {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: "USD",
		}).format(amount);
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

	// Extract variables from text in {{ variable }} format
	const extractVariables = (text: string): string[] => {
		const variableRegex = /\{\{\s*([^}]+)\s*\}\}/g;
		const matches: string[] = [];
		let match;
		while ((match = variableRegex.exec(text)) !== null) {
			if (!matches.includes(match[1].trim())) {
				matches.push(match[1].trim());
			}
		}
		return matches;
	};

	// Replace variables in text
	const replaceVariables = (
		text: string,
		variables: Record<string, string>
	): string => {
		let result = text;
		Object.entries(variables).forEach(([key, value]) => {
			const regex = new RegExp(
				`\\{\\{\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\}\\}`,
				"g"
			);
			result = result.replace(regex, value);
		});
		return result;
	};

	const EditableResponseDialog = () => {
		const [isEditing, setIsEditing] = useState(false);
		const [isSaving, setIsSaving] = useState(false);
		const [subject, setSubject] = useState("");
		const [body, setBody] = useState("");
		const [variables, setVariables] = useState<Record<string, string>>({});

		// Load variables from database
		const loadVariables = async () => {
			try {
				const { data: dbVariables, error } = await supabase
					.from("debt_variables")
					.select("variable_name, variable_value")
					.eq("debt_id", debt.id);

				if (error) throw error;

				const loadedVariables: Record<string, string> = {};
				dbVariables?.forEach((dbVar) => {
					loadedVariables[dbVar.variable_name] = dbVar.variable_value || "";
				});

				return loadedVariables;
			} catch (error) {
				console.error("Error loading variables:", error);
				return {};
			}
		};

		// Save variables to database
		const saveVariables = async (variablesToSave: Record<string, string>) => {
			try {
				// First, delete existing variables for this debt
				await supabase.from("debt_variables").delete().eq("debt_id", debt.id);

				// Then insert new variables
				const variableRecords = Object.entries(variablesToSave).map(
					([name, value]) => ({
						debt_id: debt.id,
						variable_name: name,
						variable_value: value,
					})
				);

				if (variableRecords.length > 0) {
					const { error } = await supabase
						.from("debt_variables")
						.insert(variableRecords);

					if (error) throw error;
				}
			} catch (error) {
				console.error("Error saving variables:", error);
				throw error;
			}
		};

		// Initialize data when dialog opens
		useEffect(() => {
			const initializeData = async () => {
				if (debt.metadata?.aiEmail) {
					const aiEmail = debt.metadata.aiEmail;
					setSubject(aiEmail.subject || "");
					setBody(aiEmail.body || "");

					// Extract variables from both subject and body
					const allText = `${aiEmail.subject || ""} ${aiEmail.body || ""}`;
					const extractedVars = extractVariables(allText);

					// Load saved variables from database
					const savedVariables = await loadVariables();

					// Merge extracted variables with saved values
					const initialVariables: Record<string, string> = {};
					extractedVars.forEach((variable) => {
						initialVariables[variable] = savedVariables[variable] || "";
					});

					setVariables(initialVariables);
				}
			};

			initializeData();
		}, [debt.metadata?.aiEmail]);

		// Update variables when body changes
		const handleBodyChange = (newBody: string) => {
			setBody(newBody);
			// Extract variables from the new body text
			const newVariables = extractVariables(newBody);
			const updatedVariables = { ...variables };

			// Add new variables if they don't exist
			newVariables.forEach((variable) => {
				if (!(variable in updatedVariables)) {
					updatedVariables[variable] = "";
				}
			});

			// Remove variables that no longer exist in the text
			Object.keys(updatedVariables).forEach((variable) => {
				if (
					!newVariables.includes(variable) &&
					!extractVariables(subject).includes(variable)
				) {
					delete updatedVariables[variable];
				}
			});

			setVariables(updatedVariables);
		};

		// Update variables when subject changes
		const handleSubjectChange = (newSubject: string) => {
			setSubject(newSubject);
			// Extract variables from the new subject text
			const newVariables = extractVariables(newSubject);
			const updatedVariables = { ...variables };

			// Add new variables if they don't exist
			newVariables.forEach((variable) => {
				if (!(variable in updatedVariables)) {
					updatedVariables[variable] = "";
				}
			});

			// Remove variables that no longer exist in the text
			Object.keys(updatedVariables).forEach((variable) => {
				if (
					!newVariables.includes(variable) &&
					!extractVariables(body).includes(variable)
				) {
					delete updatedVariables[variable];
				}
			});

			setVariables(updatedVariables);
		};

		// Update variables only (don't modify the text)
		const handleVariableChange = (variableName: string, value: string) => {
			const newVariables = { ...variables, [variableName]: value };
			setVariables(newVariables);
		};

		// Get preview text with variables replaced
		const getPreviewText = () => {
			return replaceVariables(`Subject: ${subject}\n\n${body}`, variables);
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
					toast({
						title: "Error",
						description: "Failed to save email changes. Please try again.",
						variant: "destructive",
					});
					return;
				}

				// Save variables to database
				await saveVariables(variables);

				toast({
					title: "Changes saved",
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
				toast({
					title: "Error",
					description: "Failed to save changes. Please try again.",
					variant: "destructive",
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
						<Edit3 className="h-4 w-4 mr-2" />
						Edit Response
					</Button>
				</DialogTrigger>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Negotiation Response</DialogTitle>
						<DialogDescription>
							Customize your FDCPA-compliant response before sending
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
													handleVariableChange(variableName, e.target.value)
												}
												placeholder={`Enter ${variableName.toLowerCase()}`}
												className="w-full"
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
								onChange={(e) => handleSubjectChange(e.target.value)}
								placeholder="Enter email subject (use {{ Variable Name }} for placeholders)"
								className="w-full"
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
								onChange={(e) => handleBodyChange(e.target.value)}
								placeholder="Enter email body (use {{ Variable Name }} for placeholders)"
								className="w-full min-h-[300px] font-mono text-sm"
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
						<div className="flex justify-end gap-2 border-t pt-4">
							<Button variant="outline" onClick={() => setIsEditing(false)}>
								Cancel
							</Button>
							<Button onClick={handleSave} disabled={isSaving}>
								{isSaving ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		);
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
					<div className="flex items-center gap-2">
						<DollarSign className="h-5 w-5 text-gray-500 dark:text-gray-400" />
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
			</CardContent>
		</Card>
	);
}
