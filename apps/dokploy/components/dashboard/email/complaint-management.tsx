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
import { AlertCircle, RefreshCw, Shield } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ComplaintManagementProps {
	emailDomainId: string;
}

export const ComplaintManagement = ({
	emailDomainId,
}: ComplaintManagementProps) => {
	const utils = api.useUtils();
	const [limit] = useState(50);

	const { data: complaints, isLoading } = api.email.getComplaints.useQuery(
		{ emailDomainId },
		{ enabled: !!emailDomainId },
	);

	const { data: complaintRate } = api.email.getComplaintRate.useQuery(
		{ emailDomainId, days: 30 },
		{ enabled: !!emailDomainId },
	);

	const { data: complaintCheck } = api.email.checkComplaintRate.useQuery(
		{ emailDomainId, threshold: 0.001 },
		{ enabled: !!emailDomainId },
	);

	const handleRefresh = async () => {
		await utils.email.getComplaints.invalidate();
		await utils.email.getComplaintRate.invalidate();
		await utils.email.checkComplaintRate.invalidate();
		toast.success("Complaint data refreshed");
	};

	const getComplaintSourceColor = (source?: string | null) => {
		switch (source) {
			case "feedback-loop":
				return "default";
			case "abuse-report":
				return "destructive";
			case "manual":
				return "secondary";
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
							<CardTitle>Complaint Management</CardTitle>
							<CardDescription>
								Monitor spam complaints and feedback loops
							</CardDescription>
						</div>
						<Button variant="outline" size="sm" onClick={handleRefresh}>
							<RefreshCw className="mr-2 h-4 w-4" />
							Refresh
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Complaint Rate Summary */}
					<div className="grid gap-4 md:grid-cols-3">
						<div className="rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Complaint Rate (30 days)</span>
								{complaintCheck?.exceeded ? (
									<AlertCircle className="h-4 w-4 text-red-600" />
								) : (
									<Shield className="h-4 w-4 text-green-600" />
								)}
							</div>
							<div className="mt-2 text-2xl font-bold">
								{((complaintRate || 0) * 100).toFixed(3)}%
							</div>
							<p className="text-xs text-muted-foreground">
								{complaintCheck?.exceeded
									? "Exceeds 0.1% threshold"
									: "Within acceptable range"}
							</p>
						</div>

						<div className="rounded-lg border p-4">
							<div className="text-sm font-medium">Total Complaints</div>
							<div className="mt-2 text-2xl font-bold">
								{complaints?.length || 0}
							</div>
							<p className="text-xs text-muted-foreground">Last 30 days</p>
						</div>

						<div className="rounded-lg border p-4">
							<div className="text-sm font-medium">Feedback Loops</div>
							<div className="mt-2 text-2xl font-bold">
								{complaints?.filter((c) => c.complaintSource === "feedback-loop")
									.length || 0}
							</div>
							<p className="text-xs text-muted-foreground">ISP reports</p>
						</div>
					</div>

					{/* Complaint Rate Alert */}
					{complaintCheck?.exceeded && (
						<div className="rounded-lg border border-red-500 bg-red-50 p-4 dark:bg-red-950">
							<div className="flex items-start gap-2">
								<AlertCircle className="h-5 w-5 text-red-600" />
								<div className="flex-1">
									<p className="font-semibold text-red-900 dark:text-red-100">
										High Complaint Rate Alert
									</p>
									<p className="text-sm text-red-800 dark:text-red-200">
										Complaint rate is {((complaintRate || 0) * 100).toFixed(3)}%,
										which exceeds the 0.1% threshold. Review your email content
										and ensure proper unsubscribe mechanisms are in place.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Complaints Table */}
					<div className="space-y-2">
						<h3 className="font-semibold">Recent Complaints</h3>
						{complaints && complaints.length > 0 ? (
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Recipient</TableHead>
											<TableHead>Source</TableHead>
											<TableHead>Message ID</TableHead>
											<TableHead>Date</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{complaints.slice(0, limit).map((complaint) => (
											<TableRow key={complaint.complaintId}>
												<TableCell className="font-medium">
													{complaint.recipientEmail}
												</TableCell>
												<TableCell>
													<Badge
														variant={getComplaintSourceColor(
															complaint.complaintSource,
														)}
													>
														{complaint.complaintSource || "unknown"}
													</Badge>
												</TableCell>
												<TableCell className="max-w-xs truncate text-muted-foreground font-mono text-xs">
													{complaint.messageId || "N/A"}
												</TableCell>
												<TableCell>
													<DateTooltip date={complaint.complaintDate} />
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						) : (
							<Card className="flex h-32 items-center justify-center">
								<p className="text-muted-foreground">No complaints recorded</p>
							</Card>
						)}
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

