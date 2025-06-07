import React, { useEffect, useState } from "react";
import {
	supabase,
	type AdditionalEmail,
	type UserProfile,
	type EmailProcessingUsage,
} from "../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
	Settings,
	Mail,
	Plus,
	Trash2,
	Check,
	X,
	TrendingUp,
	Infinity,
	AlertCircle,
} from "lucide-react";
import { toast } from "../hooks/use-toast";

export function Configuration() {
	const [profile, setProfile] = useState<UserProfile | null>(null);
	const [additionalEmails, setAdditionalEmails] = useState<AdditionalEmail[]>(
		[]
	);
	const [usage, setUsage] = useState<EmailProcessingUsage | null>(null);
	const [loading, setLoading] = useState(true);
	const [newEmail, setNewEmail] = useState("");
	const [addingEmail, setAddingEmail] = useState(false);

	useEffect(() => {
		fetchUserData();
	}, []);

	const fetchUserData = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			// Fetch user profile
			const { data: profileData } = await supabase
				.from("user_profiles")
				.select("*")
				.eq("user_id", user.id)
				.single();

			// Fetch additional emails
			const { data: emailsData } = await supabase
				.from("additional_emails")
				.select("*")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			// Fetch current month usage
			const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
			const { data: usageData } = await supabase
				.from("email_processing_usage")
				.select("*")
				.eq("user_id", user.id)
				.eq("month_year", currentMonth)
				.single();

			setProfile(profileData);
			setAdditionalEmails(emailsData || []);
			setUsage(usageData);
		} catch (error) {
			console.error("Error fetching user data:", error);
		} finally {
			setLoading(false);
		}
	};

	const addAdditionalEmail = async () => {
		if (!newEmail || !profile) return;

		setAddingEmail(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			const { data, error } = await supabase
				.from("additional_emails")
				.insert({
					user_id: user.id,
					email_address: newEmail.trim().toLowerCase(),
				})
				.select()
				.single();

			if (error) throw error;

			setAdditionalEmails([data, ...additionalEmails]);
			setNewEmail("");
			toast({
				title: "Email added successfully",
				description: "Additional email has been added to your account.",
			});
		} catch (error: any) {
			toast({
				title: "Error adding email",
				description: error.message,
				variant: "destructive",
			});
		} finally {
			setAddingEmail(false);
		}
	};

	const removeAdditionalEmail = async (emailId: string) => {
		try {
			const { error } = await supabase
				.from("additional_emails")
				.delete()
				.eq("id", emailId);

			if (error) throw error;

			setAdditionalEmails(
				additionalEmails.filter((email) => email.id !== emailId)
			);
			toast({
				title: "Email removed",
				description: "Additional email has been removed from your account.",
			});
		} catch (error: any) {
			toast({
				title: "Error removing email",
				description: error.message,
				variant: "destructive",
			});
		}
	};

	const getUsagePercentage = () => {
		if (!profile || !usage) return 0;
		return Math.min(
			(usage.emails_processed / profile.email_processing_limit) * 100,
			100
		);
	};

	const getRemainingEmails = () => {
		if (!profile || !usage) return profile?.email_processing_limit || 1000;
		return Math.max(profile.email_processing_limit - usage.emails_processed, 0);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-background">
				<div className="flex items-center gap-2 text-lg text-gray-900 dark:text-foreground">
					<Settings className="h-5 w-5 animate-spin" />
					Loading configuration...
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-background">
			<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-gray-900 dark:text-foreground flex items-center gap-3">
						<Settings className="h-8 w-8 text-primary" />
						Configuration
					</h1>
					<p className="text-gray-600 dark:text-gray-300 mt-2">
						Manage your account settings and email processing options
					</p>
				</div>

				<div className="space-y-6">
					{/* Email Processing Usage */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5" />
								Email Processing Usage
							</CardTitle>
							<CardDescription>
								Track your monthly email processing usage and limits
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-sm font-medium">
										Emails Processed This Month
									</p>
									<p className="text-2xl font-bold">
										{usage?.emails_processed || 0} /{" "}
										{profile?.email_processing_limit || 1000}
									</p>
								</div>
								<div className="text-right">
									<p className="text-sm text-muted-foreground">Remaining</p>
									<p className="text-lg font-semibold text-green-600 dark:text-green-400">
										{getRemainingEmails() ===
										(profile?.email_processing_limit || 1000) ? (
											<span className="flex items-center gap-1">
												<Infinity className="h-4 w-4" />
												Unlimited
											</span>
										) : (
											getRemainingEmails()
										)}
									</p>
								</div>
							</div>

							<div className="space-y-2">
								<div className="flex justify-between text-sm">
									<span>Progress</span>
									<span>{getUsagePercentage().toFixed(1)}%</span>
								</div>
								<Progress value={getUsagePercentage()} className="h-2" />
							</div>

							{getUsagePercentage() > 80 && (
								<Alert>
									<AlertCircle className="h-4 w-4" />
									<AlertDescription>
										You're approaching your monthly email processing limit.
										Consider upgrading your plan if you need to process more
										emails.
									</AlertDescription>
								</Alert>
							)}
						</CardContent>
					</Card>

					{/* Additional Emails */}
					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2">
								<Mail className="h-5 w-5" />
								Additional Email Addresses
							</CardTitle>
							<CardDescription>
								Add additional email addresses to process debt emails from
								multiple accounts
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{/* Add new email */}
							<div className="flex gap-2">
								<div className="flex-1">
									<Label htmlFor="newEmail" className="sr-only">
										Additional Email
									</Label>
									<Input
										id="newEmail"
										type="email"
										placeholder="additional@example.com"
										value={newEmail}
										onChange={(e) => setNewEmail(e.target.value)}
										onKeyPress={(e) => {
											if (e.key === "Enter") {
												addAdditionalEmail();
											}
										}}
									/>
								</div>
								<Button
									onClick={addAdditionalEmail}
									disabled={!newEmail || addingEmail}
									className="shrink-0"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add Email
								</Button>
							</div>

							<Separator />

							{/* List of additional emails */}
							<div className="space-y-3">
								{additionalEmails.length === 0 ? (
									<div className="text-center py-8 text-muted-foreground">
										<Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
										<p className="text-lg font-medium">No additional emails</p>
										<p className="text-sm">
											Add additional email addresses to expand your debt
											processing capabilities.
										</p>
									</div>
								) : (
									additionalEmails.map((email) => (
										<div
											key={email.id}
											className="flex items-center justify-between p-3 border rounded-lg"
										>
											<div className="flex items-center gap-3">
												<Mail className="h-4 w-4 text-muted-foreground" />
												<div>
													<p className="font-medium">{email.email_address}</p>
													<p className="text-sm text-muted-foreground">
														Added{" "}
														{new Date(email.created_at).toLocaleDateString()}
													</p>
												</div>
											</div>
											<div className="flex items-center gap-2">
												<Badge
													variant={email.verified ? "default" : "secondary"}
												>
													{email.verified ? (
														<>
															<Check className="h-3 w-3 mr-1" />
															Verified
														</>
													) : (
														<>
															<X className="h-3 w-3 mr-1" />
															Unverified
														</>
													)}
												</Badge>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => removeAdditionalEmail(email.id)}
													className="text-destructive hover:text-destructive"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										</div>
									))
								)}
							</div>
						</CardContent>
					</Card>

					{/* Account Information */}
					<Card>
						<CardHeader>
							<CardTitle>Account Information</CardTitle>
							<CardDescription>
								Your account details and settings
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div>
									<Label>Email Processing Limit</Label>
									<p className="text-lg font-semibold">
										{profile?.email_processing_limit || 1000} emails/month
									</p>
								</div>
								<div>
									<Label>Account Created</Label>
									<p className="text-lg font-semibold">
										{profile?.created_at
											? new Date(profile.created_at).toLocaleDateString()
											: "N/A"}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<Label>Onboarding Status</Label>
									<Badge
										variant={
											profile?.onboarding_completed ? "default" : "secondary"
										}
									>
										{profile?.onboarding_completed ? "Completed" : "Pending"}
									</Badge>
								</div>
								<div>
									<Label>Additional Emails</Label>
									<p className="text-lg font-semibold">
										{additionalEmails.length} configured
									</p>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
