import { useEffect, useState } from "react";
import { supabase, type Debt, type UserProfile } from "../lib/supabase";
import { Button } from "./ui/button";
import { DebtCard } from "./DebtCard";
import { ConversationTimeline } from "./ConversationTimeline";
import { OnboardingDialog } from "./OnboardingDialog";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import {
	DollarSign,
	TrendingUp,
	Mail,
	CheckCircle,
	AlertTriangle,
	RefreshCw,
	Settings,
} from "lucide-react";
import { formatCurrency } from "../lib/utils";

export function Dashboard() {
	const [debts, setDebts] = useState<Debt[]>([]);
	const [loading, setLoading] = useState(true);
	const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
	const [showOnboarding, setShowOnboarding] = useState(false);
	const [stats, setStats] = useState({
		totalDebts: 0,
		totalAmount: 0,
		projectedSavings: 0,
		settledCount: 0,
	});

	useEffect(() => {
		fetchUserProfile();
		fetchDebts();
		setupRealtimeSubscription();
	}, []);

	useEffect(() => {
		calculateStats();
	}, [debts]);

	const fetchUserProfile = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			const { data: profile } = await supabase
				.from("user_profiles")
				.select("*")
				.eq("user_id", user.id)
				.single();

			setUserProfile(profile);

			// Show onboarding if user hasn't completed it
			if (profile && !profile.onboarding_completed) {
				setShowOnboarding(true);
			}
		} catch (error) {
			console.error("Error fetching user profile:", error);
		}
	};

	const fetchDebts = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			const { data, error } = await supabase
				.from("debts")
				.select("*")
				.eq("user_id", user.id)
				.order("created_at", { ascending: false });

			if (error) throw error;
			setDebts(data || []);
		} catch (error) {
			console.error("Error fetching debts:", error);
		} finally {
			setLoading(false);
		}
	};

	const setupRealtimeSubscription = () => {
		const subscription = supabase
			.channel("debts_changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "debts",
				},
				(payload) => {
					if (payload.eventType === "INSERT") {
						setDebts((prev) => [payload.new as Debt, ...prev]);
					} else if (payload.eventType === "UPDATE") {
						setDebts((prev) =>
							prev.map((debt) =>
								debt.id === payload.new.id ? (payload.new as Debt) : debt
							)
						);
					} else if (payload.eventType === "DELETE") {
						setDebts((prev) =>
							prev.filter((debt) => debt.id !== payload.old.id)
						);
					}
				}
			)
			.subscribe();

		return () => {
			subscription.unsubscribe();
		};
	};

	const calculateStats = () => {
		const totalDebts = debts.length;
		const totalAmount = debts.reduce((sum, debt) => sum + debt.amount, 0);
		const projectedSavings = debts.reduce((sum, debt) => {
			// Use actual savings for accepted debts, projected for others
			if (debt.status === "accepted" && debt.metadata?.actualSavings?.amount) {
				return sum + debt.metadata.actualSavings.amount;
			}
			return sum + debt.projected_savings;
		}, 0);
		const settledCount = debts.filter(
			(debt) => debt.status === "settled"
		).length;

		setStats({
			totalDebts,
			totalAmount,
			projectedSavings,
			settledCount,
		});
	};

	const handleOnboardingComplete = () => {
		setShowOnboarding(false);
		// Refresh user profile to reflect onboarding completion
		fetchUserProfile();
	};

	const handleSignOut = async () => {
		await supabase.auth.signOut();
		window.location.href = "/";
	};

	const groupedDebts = {
		all: debts,
		active: debts.filter((debt) =>
			[
				"received",
				"negotiating",
				"approved",
				"awaiting_response",
				"counter_negotiating",
				"requires_manual_review",
			].includes(debt.status)
		),
		settled: debts.filter((debt) =>
			["settled", "accepted", "sent"].includes(debt.status)
		),
		failed: debts.filter((debt) =>
			["failed", "rejected", "opted_out"].includes(debt.status)
		),
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-background">
				<div className="flex items-center gap-2 text-lg text-gray-900 dark:text-foreground">
					<RefreshCw className="h-5 w-5 animate-spin" />
					Loading dashboard...
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-background">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
				{/* Header */}
				<div className="mb-8 flex justify-between items-start">
					<div>
						<h1 className="text-3xl font-bold text-gray-900 dark:text-foreground flex items-center gap-3">
							Dashboard
						</h1>
						<p className="text-gray-600 dark:text-gray-300 mt-2">
							AI-powered debt resolution platform with real-time updates
						</p>
					</div>
					<Button asChild>
						<a href="/configuration" className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							Configuration
						</a>
					</Button>
				</div>

				{/* Stats Cards */}
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">Total Debts</CardTitle>
							<Mail className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{stats.totalDebts}</div>
							<p className="text-xs text-muted-foreground">Emails processed</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Total Amount
							</CardTitle>
							<DollarSign className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">
								{formatCurrency(stats.totalAmount)}
							</div>
							<p className="text-xs text-muted-foreground">Across all debts</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Projected Savings
							</CardTitle>
							<TrendingUp className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold text-green-600 dark:text-green-400">
								{formatCurrency(stats.projectedSavings)}
							</div>
							<p className="text-xs text-muted-foreground">From negotiations</p>
						</CardContent>
					</Card>

					<Card>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="text-sm font-medium">
								Settled Cases
							</CardTitle>
							<CheckCircle className="h-4 w-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							<div className="text-2xl font-bold">{stats.settledCount}</div>
							<p className="text-xs text-muted-foreground">
								Successfully resolved
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Main Content */}
				<Tabs defaultValue="all" className="space-y-6">
					<TabsList className="grid w-full grid-cols-4">
						<TabsTrigger value="all" className="flex items-center gap-2">
							All Debts
							<Badge variant="secondary" className="ml-1">
								{groupedDebts.all.length}
							</Badge>
						</TabsTrigger>
						<TabsTrigger value="active" className="flex items-center gap-2">
							Active
							<Badge variant="secondary" className="ml-1">
								{groupedDebts.active.length}
							</Badge>
						</TabsTrigger>
						<TabsTrigger value="settled" className="flex items-center gap-2">
							Settled
							<Badge variant="secondary" className="ml-1">
								{groupedDebts.settled.length}
							</Badge>
						</TabsTrigger>
						<TabsTrigger value="failed" className="flex items-center gap-2">
							Failed/Opted Out
							<Badge variant="secondary" className="ml-1">
								{groupedDebts.failed.length}
							</Badge>
						</TabsTrigger>
					</TabsList>

					{Object.entries(groupedDebts).map(([key, debtList]) => (
						<TabsContent key={key} value={key} className="space-y-6">
							{debtList.length === 0 ? (
								<Card>
									<CardContent className="flex flex-col items-center justify-center py-12">
										<AlertTriangle className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
										<h3 className="text-lg font-medium text-gray-900 dark:text-foreground mb-2">
											No debts found
										</h3>
										<p className="text-gray-600 dark:text-gray-300 text-center max-w-md">
											{key === "all"
												? "Forward your first debt email to get started with automated negotiations."
												: `No debts with ${key} status found.`}
										</p>
									</CardContent>
								</Card>
							) : (
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
									{debtList.map((debt) => (
										<div key={debt.id} className="space-y-4">
											<DebtCard debt={debt} onUpdate={fetchDebts} />
											<ConversationTimeline
												debt={debt}
												onDebtUpdate={(debt) => {
													setDebts(
														debts.map((d) => (d.id === debt.id ? debt : d))
													);
												}}
											/>
										</div>
									))}
								</div>
							)}
						</TabsContent>
					))}
				</Tabs>

				{/* Footer */}
				<Separator className="my-8" />
				<div className="text-center text-sm text-gray-600 dark:text-gray-300">
					<p>InboxNegotiator - FDCPA-compliant debt resolution platform</p>
					<p className="mt-1">Real-time updates powered by Supabase</p>
				</div>
			</div>

			{/* Onboarding Dialog */}
			<OnboardingDialog
				open={showOnboarding}
				onComplete={handleOnboardingComplete}
			/>
		</div>
	);
}
