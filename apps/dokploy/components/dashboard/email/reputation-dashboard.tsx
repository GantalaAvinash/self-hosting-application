import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/utils/api";
import {
	AlertCircle,
	CheckCircle2,
	RefreshCw,
	Shield,
	TrendingDown,
	TrendingUp,
	XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface ReputationDashboardProps {
	emailDomainId: string;
}

export const ReputationDashboard = ({
	emailDomainId,
}: ReputationDashboardProps) => {
	const utils = api.useUtils();
	const { data: reputation, isLoading } = api.email.getReputation.useQuery(
		{ emailDomainId },
		{ enabled: !!emailDomainId },
	);

	const { data: reputationCheck } = api.email.checkReputation.useQuery(
		{ emailDomainId },
		{ enabled: !!emailDomainId },
	);

	const { mutateAsync: checkIPReputation } =
		api.email.checkIPReputation.useMutation();

	const { data: domain } = api.email.getDomain.useQuery(
		{ emailDomainId },
		{ enabled: !!emailDomainId },
	);

	const handleRefresh = async () => {
		await utils.email.getReputation.invalidate();
		await utils.email.checkReputation.invalidate();
		if (domain?.mailServerIp) {
			await checkIPReputation({ ip: domain.mailServerIp });
		}
		toast.success("Reputation data refreshed");
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

	if (!reputation) {
		return (
			<Card>
				<CardContent className="flex h-48 items-center justify-center">
					<p className="text-muted-foreground">No reputation data available</p>
				</CardContent>
			</Card>
		);
	}

	const senderScore = reputation.senderScore || 0;
	const bounceRate = reputation.bounceRate * 100;
	const complaintRate = reputation.complaintRate * 100;
	const deliveryRate = reputation.deliveryRate * 100;

	const getScoreColor = (score: number) => {
		if (score >= 80) return "text-green-600";
		if (score >= 60) return "text-yellow-600";
		if (score >= 40) return "text-orange-600";
		return "text-red-600";
	};

	const getScoreVariant = (score: number): "default" | "secondary" | "destructive" => {
		if (score >= 80) return "default";
		if (score >= 60) return "secondary";
		return "destructive";
	};

	const blacklistStatus = reputation.blacklistStatus
		? JSON.parse(reputation.blacklistStatus)
		: null;

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Reputation Overview</CardTitle>
							<CardDescription>
								Monitor your email domain's sender reputation
							</CardDescription>
						</div>
						<Button variant="outline" size="sm" onClick={handleRefresh}>
							<RefreshCw className="mr-2 h-4 w-4" />
							Refresh
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Sender Score */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Shield className="h-5 w-5 text-muted-foreground" />
								<span className="font-semibold">Sender Score</span>
							</div>
							<Badge variant={getScoreVariant(senderScore)} className="text-lg">
								{senderScore}/100
							</Badge>
						</div>
						<Progress value={senderScore} className="h-3" />
						<p className="text-xs text-muted-foreground">
							{senderScore >= 80
								? "Excellent reputation"
								: senderScore >= 60
									? "Good reputation"
									: senderScore >= 40
										? "Fair reputation - needs improvement"
										: "Poor reputation - action required"}
						</p>
					</div>

					{/* Metrics Grid */}
					<div className="grid gap-4 md:grid-cols-3">
						{/* Delivery Rate */}
						<div className="space-y-2 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Delivery Rate</span>
								{deliveryRate >= 95 ? (
									<TrendingUp className="h-4 w-4 text-green-600" />
								) : (
									<TrendingDown className="h-4 w-4 text-red-600" />
								)}
							</div>
							<div className="text-2xl font-bold">{deliveryRate.toFixed(2)}%</div>
							<Progress
								value={deliveryRate}
								className="h-2"
							/>
							<p className="text-xs text-muted-foreground">
								{reputation.totalDelivered} of {reputation.totalSent} delivered
							</p>
						</div>

						{/* Bounce Rate */}
						<div className="space-y-2 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Bounce Rate</span>
								{bounceRate <= 2 ? (
									<CheckCircle2 className="h-4 w-4 text-green-600" />
								) : bounceRate <= 5 ? (
									<AlertCircle className="h-4 w-4 text-yellow-600" />
								) : (
									<XCircle className="h-4 w-4 text-red-600" />
								)}
							</div>
							<div className="text-2xl font-bold">{bounceRate.toFixed(2)}%</div>
							<Progress
								value={bounceRate}
								className="h-2"
							/>
							<p className="text-xs text-muted-foreground">
								{reputation.totalBounced} bounces
							</p>
						</div>

						{/* Complaint Rate */}
						<div className="space-y-2 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Complaint Rate</span>
								{complaintRate <= 0.1 ? (
									<CheckCircle2 className="h-4 w-4 text-green-600" />
								) : (
									<XCircle className="h-4 w-4 text-red-600" />
								)}
							</div>
							<div className="text-2xl font-bold">{complaintRate.toFixed(3)}%</div>
							<Progress
								value={complaintRate * 10}
								className="h-2"
							/>
							<p className="text-xs text-muted-foreground">
								{reputation.totalComplained} complaints
							</p>
						</div>
					</div>

					{/* Blacklist Status */}
					{blacklistStatus && (
						<div className="space-y-2 rounded-lg border p-4">
							<div className="flex items-center justify-between">
								<span className="font-semibold">IP Blacklist Status</span>
								{blacklistStatus.blacklisted ? (
									<Badge variant="destructive">Blacklisted</Badge>
								) : (
									<Badge variant="default">Clean</Badge>
								)}
							</div>
							{blacklistStatus.blacklisted ? (
								<div className="space-y-2">
									<p className="text-sm text-destructive">
										IP is listed on: {blacklistStatus.blacklists.join(", ")}
									</p>
									<p className="text-xs text-muted-foreground">
										Take immediate action to resolve blacklist issues
									</p>
								</div>
							) : (
								<p className="text-sm text-muted-foreground">
									IP is not listed on any major blacklists
								</p>
							)}
						</div>
					)}

					{/* Issues Alert */}
					{reputationCheck?.poor && (
						<div className="rounded-lg border border-yellow-500 bg-yellow-50 p-4 dark:bg-yellow-950">
							<div className="flex items-start gap-2">
								<AlertCircle className="h-5 w-5 text-yellow-600" />
								<div className="flex-1 space-y-1">
									<p className="font-semibold text-yellow-900 dark:text-yellow-100">
										Reputation Issues Detected
									</p>
									<ul className="list-disc space-y-1 pl-5 text-sm text-yellow-800 dark:text-yellow-200">
										{reputationCheck.issues.map((issue, index) => (
											<li key={index}>{issue}</li>
										))}
									</ul>
								</div>
							</div>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

