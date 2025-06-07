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
	const [step, setStep] = useState<"welcome" | "email" | "complete">("welcome");
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [skipEmail, setSkipEmail] = useState(false);

	const handleAddEmail = async () => {
		if (!email && !skipEmail) return;

		setLoading(true);
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			if (email && !skipEmail) {
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
								<Button onClick={() => setStep("email")}>
									Get Started
									<ArrowRight className="h-4 w-4 ml-2" />
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
									onClick={handleAddEmail}
									disabled={!email || loading}
									className="min-w-[100px]"
								>
									{loading ? "Adding..." : "Add Email"}
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
