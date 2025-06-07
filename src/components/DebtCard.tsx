import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, DollarSign, Mail, FileText, TrendingUp } from "lucide-react";
import type { Debt } from "../lib/supabase";

interface DebtCardProps {
	debt: Debt;
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

export function DebtCard({ debt }: DebtCardProps) {
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

					{debt.negotiated_plan && (
						<Dialog>
							<DialogTrigger asChild>
								<Button variant="outline" size="sm" className="flex-1">
									<FileText className="h-4 w-4 mr-2" />
									View Response
								</Button>
							</DialogTrigger>
							<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
								<DialogHeader>
									<DialogTitle>AI-Generated Negotiation Response</DialogTitle>
									<DialogDescription>
										FDCPA-compliant response ready to send
									</DialogDescription>
								</DialogHeader>
								<div className="mt-4">
									<pre className="whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border dark:border-gray-700">
										{debt.negotiated_plan}
									</pre>
								</div>
							</DialogContent>
						</Dialog>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
