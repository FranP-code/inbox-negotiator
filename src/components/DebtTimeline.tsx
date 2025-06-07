import React from "react";
import {
	CheckCircle,
	Clock,
	AlertCircle,
	XCircle,
	StopCircle,
} from "lucide-react";
import type { Debt } from "../lib/supabase";

interface DebtTimelineProps {
	debt: Debt;
}

const timelineSteps = [
	{ key: "received", label: "Email Received", icon: CheckCircle },
	{ key: "negotiating", label: "Negotiating", icon: Clock },
	{ key: "settled", label: "Settled", icon: CheckCircle },
];

const statusIcons = {
	received: CheckCircle,
	negotiating: Clock,
	settled: CheckCircle,
	failed: XCircle,
	opted_out: StopCircle,
};

const statusColors = {
	received: "text-blue-600 dark:text-blue-400",
	negotiating: "text-yellow-600 dark:text-yellow-400",
	settled: "text-green-600 dark:text-green-400",
	failed: "text-red-600 dark:text-red-400",
	opted_out: "text-gray-600 dark:text-gray-400",
};

export function DebtTimeline({ debt }: DebtTimelineProps) {
	const currentStepIndex = timelineSteps.findIndex(
		(step) => step.key === debt.status
	);

	return (
		<div className="space-y-4">
			<h3 className="text-lg font-semibold">Progress Timeline</h3>

			<div className="space-y-4">
				{timelineSteps.map((step, index) => {
					const isCompleted = index <= currentStepIndex;
					const isActive = index === currentStepIndex;
					const Icon = step.icon;

					return (
						<div key={step.key} className="flex items-center gap-3">
							<div
								className={`
                flex items-center justify-center w-8 h-8 rounded-full border-2
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

							<div className="flex-1">
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
										{debt.status === "received" &&
											"Processing email and generating response..."}
										{debt.status === "negotiating" &&
											"Response generated, waiting for creditor reply"}
										{debt.status === "settled" && "Payment plan agreed upon"}
									</div>
								)}
							</div>

							{isActive && (
								<div className="text-sm text-gray-500 dark:text-gray-400">
									{new Date(debt.updated_at).toLocaleDateString()}
								</div>
							)}
						</div>
					);
				})}

				{/* Special cases for failed and opted_out */}
				{(debt.status === "failed" || debt.status === "opted_out") && (
					<div className="flex items-center gap-3">
						<div
							className={`
              flex items-center justify-center w-8 h-8 rounded-full border-2
              ${
								debt.status === "failed"
									? "border-red-500 text-red-500 dark:border-red-400 dark:text-red-400"
									: "border-gray-500 text-gray-500 dark:border-gray-400 dark:text-gray-400"
							}
            `}
						>
							{React.createElement(statusIcons[debt.status], {
								className: "h-4 w-4",
							})}
						</div>

						<div className="flex-1">
							<div className={`font-medium ${statusColors[debt.status]}`}>
								{debt.status === "failed" ? "Negotiation Failed" : "Opted Out"}
							</div>
							<div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
								{debt.status === "failed"
									? "Creditor declined the negotiation proposal"
									: "User requested to stop communication"}
							</div>
						</div>

						<div className="text-sm text-gray-500 dark:text-gray-400">
							{new Date(debt.updated_at).toLocaleDateString()}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
