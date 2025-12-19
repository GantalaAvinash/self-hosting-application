import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/utils/api";
import { AlertCircle, CheckCircle2, RefreshCw, XCircle } from "lucide-react";

interface MailServerHealthProps {
	className?: string;
}

export const MailServerHealth = ({ className }: MailServerHealthProps) => {
	const {
		data: health,
		refetch,
		isLoading: isChecking,
	} = api.email.checkMailServerHealth.useQuery(undefined, {
		refetchInterval: 30000, // Auto-refresh every 30s
	});

	const checkHealth = () => {
		refetch();
	};

	const getStatusIcon = () => {
		if (!health || isChecking) return null;

		if (!health.running) {
			return <XCircle className="h-5 w-5 text-destructive" />;
		}

		if (health.healthy) {
			return <CheckCircle2 className="h-5 w-5 text-green-500" />;
		}

		return <AlertCircle className="h-5 w-5 text-yellow-500" />;
	};

	const getStatusBadge = () => {
		if (!health || isChecking) return null;

		if (!health.running) {
			return <Badge variant="destructive">Not Running</Badge>;
		}

		if (health.healthy) {
			return (
				<Badge variant="default" className="bg-green-500">
					Healthy
				</Badge>
			);
		}

		return <Badge variant="secondary">Unhealthy</Badge>;
	};

	return (
		<Card className={className}>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle className="text-lg">Mail Server Status</CardTitle>
					<Button
						variant="outline"
						size="sm"
						onClick={checkHealth}
						disabled={isChecking}
					>
						{isChecking ? (
							<RefreshCw className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCw className="h-4 w-4" />
						)}
						Check Health
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{!health && !isChecking && (
					<Alert>
						<AlertCircle className="h-4 w-4" />
						<AlertTitle>Unknown Status</AlertTitle>
						<AlertDescription>
							Click "Check Health" to verify mail server status
						</AlertDescription>
					</Alert>
				)}

				{isChecking && (
					<Alert>
						<RefreshCw className="h-4 w-4 animate-spin" />
						<AlertDescription>Checking mail server status...</AlertDescription>
					</Alert>
				)}

				{health && !isChecking && (
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								{getStatusIcon()}
								<span className="font-medium">Status</span>
							</div>
							{getStatusBadge()}
						</div>

						<Alert variant={health.healthy ? "default" : "destructive"}>
							<AlertDescription>{health.message}</AlertDescription>
						</Alert>

						{!health.running && (
							<div className="text-sm text-muted-foreground">
								<p>The mail server container is not running. To start it:</p>
								<code className="mt-2 block rounded bg-muted p-2">
									docker-compose -f templates/mail-server/docker-compose.yml up -d
								</code>
							</div>
						)}

						{health.running && !health.healthy && (
							<div className="text-sm text-muted-foreground">
								<p>The mail server is running but may have issues. Check logs:</p>
								<code className="mt-2 block rounded bg-muted p-2">
									docker logs mailserver
								</code>
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
