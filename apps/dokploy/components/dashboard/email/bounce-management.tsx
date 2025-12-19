import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { api } from "@/utils/api";
import { AlertCircle, RefreshCw, TrendingDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BounceManagementProps {
	emailDomainId: string;
}

export const BounceManagement = ({ emailDomainId }: BounceManagementProps) => {
	const utils = api.useUtils();
	const [limit] = useState(50);

	const { data: bounces, isLoading } = api.email.getBounces.useQuery(
		{ emailDomainId },
		{ enabled: !!emailDomainId },
	);

	const { data: bounceRate } = api.email.getBounceRate.useQuery(
		{ emailDomainId, days: 30 },
		{ enabled: !!emailDomainId },
	);

	const { data: bounceCheck } = api.email.checkBounceRate.useQuery(
		{ emailDomainId, threshold: 0.05 },
		{ enabled: !!emailDomainId },
	);

	const handleRefresh = async () => {
		await utils.email.getBounces.invalidate();
		await utils.email.getBounceRate.invalidate();
		await utils.email.checkBounceRate.invalidate();
		toast.success("Bounce data refreshed");
	};

	const getBounceTypeColor = (type: string) => {
		switch (type) {
			case "hard":
				return "destructive";
			case "soft":
				return "secondary";
			case "transient":
				return "default";
			default:
				return "default";
		}
	};

	if (isLoading) {
		return (
			<Card>
				<CardContent className="flex h-48 items-center justify-center">
					<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Bounce Management</CardTitle>
							<CardDescription>
								Monitor and manage email bounces
							</CardDescription>
						</div>
						<Button variant="outline" size="sm" onClick={handleRefresh}>
							<RefreshCw className="mr-2 h-4 w-4" />
							Refresh
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Bounce Rate Summary */}
					<div className="grid gap-4 md:grid-cols-3">
						<div className="rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Bounce Rate (30 days)</span>
								{bounceCheck?.exceeded ? (
									<AlertCircle className="h-4 w-4 text-red-600" />
								) : (
									<TrendingDown className="h-4 w-4 text-green-600" />
								)}
							</div>
							<div className="mt-2 text-2xl font-bold">
								{((bounceRate || 0) * 100).toFixed(2)}%
							</div>
							<p className="text-xs text-muted-foreground">
								{bounceCheck?.exceeded
									? "Exceeds 5% threshold"
									: "Within acceptable range"}
							</p>
						</div>

						<div className="rounded-lg border p-4">
							<div className="text-sm font-medium">Total Bounces</div>
							<div className="mt-2 text-2xl font-bold">
								{bounces?.length || 0}
							</div>
							<p className="text-xs text-muted-foreground">Last 30 days</p>
						</div>

						<div className="rounded-lg border p-4">
							<div className="text-sm font-medium">Hard Bounces</div>
							<div className="mt-2 text-2xl font-bold">
								{bounces?.filter((b) => b.bounceType === "hard").length || 0}
							</div>
							<p className="text-xs text-muted-foreground">Auto-suppressed</p>
						</div>
					</div>

					{/* Bounce Rate Alert */}
					{bounceCheck?.exceeded && (
						<div className="rounded-lg border border-red-500 bg-red-50 p-4 dark:bg-red-950">
							<div className="flex items-start gap-2">
								<AlertCircle className="h-5 w-5 text-red-600" />
								<div className="flex-1">
									<p className="font-semibold text-red-900 dark:text-red-100">
										High Bounce Rate Alert
									</p>
									<p className="text-sm text-red-800 dark:text-red-200">
										Bounce rate is {((bounceRate || 0) * 100).toFixed(2)}%, which
										exceeds the 5% threshold. Review your email list and remove
										invalid addresses.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Bounces Table */}
					<div className="space-y-2">
						<h3 className="font-semibold">Recent Bounces</h3>
						{bounces && bounces.length > 0 ? (
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Recipient</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Code</TableHead>
											<TableHead>Message</TableHead>
											<TableHead>Date</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{bounces.slice(0, limit).map((bounce) => (
											<TableRow key={bounce.bounceId}>
												<TableCell className="font-medium">
													{bounce.recipientEmail}
												</TableCell>
												<TableCell>
													<Badge variant={getBounceTypeColor(bounce.bounceType)}>
														{bounce.bounceType}
													</Badge>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{bounce.bounceCode || "N/A"}
												</TableCell>
												<TableCell className="max-w-xs truncate text-muted-foreground">
													{bounce.bounceMessage || "No message"}
												</TableCell>
												<TableCell>
													<DateTooltip date={bounce.bouncedAt} />
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						) : (
							<Card className="flex h-32 items-center justify-center">
								<p className="text-muted-foreground">No bounces recorded</p>
							</Card>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

