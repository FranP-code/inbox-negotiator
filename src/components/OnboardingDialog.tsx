import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Plus, CheckCircle, ArrowRight, UserCheck } from "lucide-react";
import { toast } from "../hooks/use-toast";

interface OnboardingDialogProps {
	open: boolean;
	onComplete: () => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
	const [step, setStep] = useState<
		"welcome" | "personal" | "email" | "complete"
	>("welcome");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [skipEmail, setSkipEmail] = useState(false);

	// Personal data state
	const [personalData, setPersonalData] = useState({
		full_name: "",
		address_line_1: "",
		address_line_2: "",
		city: "",
		state: "",
		zip_code: "",
		phone_number: "",
	});

	const handleSavePersonalData = async () => {
		setLoading(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			const { error } = await supabase
				.from("users")
				.update({
					full_name: personalData.full_name || null,
					address_line_1: personalData.address_line_1 || null,
					address_line_2: personalData.address_line_2 || null,
					city: personalData.city || null,
					state: personalData.state || null,
					zip_code: personalData.zip_code || null,
					phone_number: personalData.phone_number || null,
				})
				.eq("id", user.id);

			if (error) throw error;

			setStep("email");
		} catch (error: any) {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleAddEmail = async (_skipEmail?: boolean) => {
		if (!email && !_skipEmail) return;

		setLoading(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			if (email && !_skipEmail) {
				const { error } = await supabase.from("additional_emails").insert({
					user_id: user.id,
					email_address: email.trim().toLowerCase(),
				});

				if (error) throw error;
			}

			// Mark onboarding as completed
			const { error: profileError } = await supabase
				.from("user_profiles")
				.update({ onboarding_completed: true })
				.eq("user_id", user.id);

			if (profileError) throw profileError;

			setStep("complete");
		} catch (error: any) {
			toast({
				title: "Error",
				description: error.message,
				variant: "destructive",
			});
		} finally {
			setLoading(false);
		}
	};

	const handleComplete = () => {
		onComplete();
	};

	const handleSkipEmail = () => {
		setSkipEmail(true);
		handleAddEmail(true);
	};

	return (
		<Dialog open={open} onOpenChange={() => {}}>
			<DialogContent className="sm:max-w-md [&>button]:hidden">
				{/* Hide close button */}
				{step === "welcome" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<UserCheck className="h-6 w-6 text-green-500" />
								Welcome to InboxNegotiator!
							</DialogTitle>
						</DialogHeader>
						<DialogDescription>
							Your account has been created successfully. Let's get you set up
							to start processing debt emails with AI assistance.
						</DialogDescription>

						<div className="space-y-4">
							<Alert>
								<Mail className="h-4 w-4" />
								<AlertDescription>
									InboxNegotiator helps you automatically negotiate debt
									settlements by processing emails sent to your configured email
									addresses.
								</AlertDescription>
							</Alert>

							{/* <div className="space-y-2">
								<h4 className="font-medium">What you can do:</h4>
								<ul className="text-sm space-y-1 text-muted-foreground">
									<li>• Process up to 1,000 debt emails per month</li>
									<li>• AI-powered debt amount and vendor extraction</li>
									<li>• Automated negotiation responses</li>
									<li>• Real-time tracking and analytics</li>
								</ul>
							</div> */}

							<div className="flex justify-end">
								<Button onClick={() => setStep("personal")}>
									Get Started
									<ArrowRight className="h-4 w-4 ml-2" />
								</Button>
							</div>
						</div>
					</>
				)}

				{step === "personal" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<UserCheck className="h-6 w-6 text-primary" />
								Personal Information
							</DialogTitle>
						</DialogHeader>
						<DialogDescription>
							Please provide your personal information. This will be used to
							generate formal negotiation letters.
						</DialogDescription>
						<DialogDescription className="text-sm text-muted-foreground">
							All fields are optional, but providing complete information will
							result in more professional letters.
						</DialogDescription>

						<div className="space-y-4 overflow-y-auto">
							<div className="grid grid-cols-1 gap-4">
								<div className="space-y-2">
									<Label htmlFor="full_name">Full Name</Label>
									<Input
										id="full_name"
										placeholder="John Doe"
										value={personalData.full_name}
										onChange={(e) =>
											setPersonalData({
												...personalData,
												full_name: e.target.value,
											})
										}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="address_line_1">Address Line 1</Label>
									<Input
										id="address_line_1"
										placeholder="123 Main Street"
										value={personalData.address_line_1}
										onChange={(e) =>
											setPersonalData({
												...personalData,
												address_line_1: e.target.value,
											})
										}
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="address_line_2">Address Line 2</Label>
									<Input
										id="address_line_2"
										placeholder="Apt 4B"
										value={personalData.address_line_2}
										onChange={(e) =>
											setPersonalData({
												...personalData,
												address_line_2: e.target.value,
											})
										}
									/>
								</div>

								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label htmlFor="city">City</Label>
										<Input
											id="city"
											placeholder="New York"
											value={personalData.city}
											onChange={(e) =>
												setPersonalData({
													...personalData,
													city: e.target.value,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="state">State</Label>
										<Input
											id="state"
											placeholder="NY"
											value={personalData.state}
											onChange={(e) =>
												setPersonalData({
													...personalData,
													state: e.target.value,
												})
											}
										/>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-2">
									<div className="space-y-2">
										<Label htmlFor="zip_code">Zip Code</Label>
										<Input
											id="zip_code"
											placeholder="10001"
											value={personalData.zip_code}
											onChange={(e) =>
												setPersonalData({
													...personalData,
													zip_code: e.target.value,
												})
											}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="phone_number">Phone Number</Label>
										<Input
											id="phone_number"
											placeholder="(555) 123-4567"
											value={personalData.phone_number}
											onChange={(e) =>
												setPersonalData({
													...personalData,
													phone_number: e.target.value,
												})
											}
										/>
									</div>
								</div>
							</div>

							<div className="flex gap-2 justify-end">
								<Button
									variant="outline"
									onClick={() => setStep("email")}
									disabled={loading}
								>
									Skip for now
								</Button>
								<Button
									onClick={handleSavePersonalData}
									disabled={loading}
									className="min-w-[100px]"
								>
									{loading ? "Saving..." : "Continue"}
								</Button>
							</div>
						</div>
					</>
				)}

				{step === "email" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<Plus className="h-6 w-6 text-primary" />
								Add Additional Email (Optional)
							</DialogTitle>
						</DialogHeader>
						<DialogDescription>
							Would you like to add an additional email address to process debt
							emails from multiple accounts?
						</DialogDescription>
						<DialogDescription>
							You can attach here the Postmark inbound email address for the
							additional email.{" "}
							<a
								className="text-blue-600 dark:text-blue-500 hover:underline"
								href="https://postmarkapp.com/blog/an-introduction-to-inbound-email-parsing-what-it-is-and-how-you-can-do-it#how-to-use-postmark-for-email-parsing"
								target="_blank"
								rel="noopener noreferrer"
							>
								Postmark Inbound Email Parsing Guide
							</a>
						</DialogDescription>

						<div className="space-y-4">
							<div className="space-y-2">
								<Label htmlFor="additional-email">
									Additional Email Address
								</Label>
								<Input
									id="additional-email"
									type="email"
									placeholder="additional@example.com"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									onKeyPress={(e) => {
										if (e.key === "Enter" && email) {
											handleAddEmail();
										}
									}}
								/>
								<p className="text-xs text-muted-foreground">
									You can always add more email addresses later in the
									configuration page.
								</p>
							</div>

							<div className="flex gap-2 justify-end">
								<Button
									variant="outline"
									onClick={handleSkipEmail}
									disabled={loading}
								>
									Skip for now
								</Button>
								<Button
									onClick={() => handleAddEmail()}
									disabled={!email || loading}
									className="min-w-[100px]"
								>
									{loading && email ? "Adding..." : "Add Email"}
								</Button>
							</div>
						</div>
					</>
				)}

				{step === "complete" && (
					<>
						<DialogHeader>
							<DialogTitle className="flex items-center gap-2">
								<CheckCircle className="h-6 w-6 text-green-500" />
								Setup Complete!
							</DialogTitle>
							<DialogDescription>
								Your account is now ready to process debt emails with AI
								assistance.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4">
							<Alert>
								<Mail className="h-4 w-4" />
								<AlertDescription>
									Start by forwarding debt collection emails to your configured
									addresses. Our AI will automatically extract debt information
									and begin the negotiation process.
								</AlertDescription>
							</Alert>

							<div className="space-y-2">
								<h4 className="font-medium">Next steps:</h4>
								<ul className="text-sm space-y-1 text-muted-foreground">
									<li>• Forward debt emails to your monitored addresses</li>
									<li>• Monitor negotiations in your dashboard</li>
									<li>• Review AI-generated settlement offers</li>
									<li>• Track your savings and progress</li>
								</ul>
							</div>

							<div className="flex justify-end">
								<Button onClick={handleComplete}>
									Go to Dashboard
									<ArrowRight className="h-4 w-4 ml-2" />
								</Button>
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
