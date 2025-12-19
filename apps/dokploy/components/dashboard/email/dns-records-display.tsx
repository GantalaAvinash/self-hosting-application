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
import { api } from "@/utils/api";
import { CheckCircle2, Copy, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

interface DNSRecordsDisplayProps {
	emailDomainId: string;
}

export const DNSRecordsDisplay = ({ emailDomainId }: DNSRecordsDisplayProps) => {
	const utils = api.useUtils();
	const { data: dnsRecords, isLoading } = api.email.getDNSRecords.useQuery(
		{ emailDomainId },
		{ enabled: !!emailDomainId },
	);

	const handleRefresh = async () => {
		await utils.email.getDNSRecords.invalidate();
		toast.success("DNS records refreshed");
	};

	const copyToClipboard = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
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

	if (!dnsRecords) {
		return (
			<Card>
				<CardContent className="flex h-48 items-center justify-center">
					<p className="text-muted-foreground">No DNS records found</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle>Current DNS Records</CardTitle>
						<CardDescription>
							Actual DNS records detected for this domain
						</CardDescription>
					</div>
					<Button variant="outline" size="sm" onClick={handleRefresh}>
						<RefreshCw className="mr-2 h-4 w-4" />
						Refresh
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-4">
					{/* MX Records */}
					{dnsRecords.mx && dnsRecords.mx.length > 0 && (
						<div className="space-y-2">
							<h3 className="font-semibold">MX Records</h3>
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Host</TableHead>
											<TableHead>Priority</TableHead>
											<TableHead>Value</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{dnsRecords.mx.map((record, index) => (
											<TableRow key={index}>
												<TableCell className="font-mono text-sm">
													{record.host || "@"}
												</TableCell>
												<TableCell>{record.priority || "N/A"}</TableCell>
												<TableCell className="font-mono text-sm">
													{record.value}
												</TableCell>
												<TableCell>
													{record.verified ? (
														<Badge variant="default" className="bg-green-500">
															<CheckCircle2 className="mr-1 h-3 w-3" />
															Verified
														</Badge>
													) : (
														<Badge variant="secondary">
															<XCircle className="mr-1 h-3 w-3" />
															Not Verified
														</Badge>
													)}
												</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															copyToClipboard(record.value, "MX Record")
														}
													>
														<Copy className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}

					{/* TXT Records (SPF, DKIM, DMARC) */}
					{dnsRecords.txt && dnsRecords.txt.length > 0 && (
						<div className="space-y-2">
							<h3 className="font-semibold">TXT Records</h3>
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Host</TableHead>
											<TableHead>Type</TableHead>
											<TableHead>Value</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{dnsRecords.txt.map((record, index) => {
											const recordType =
												record.host?.includes("_dmarc")
													? "DMARC"
													: record.host?.includes("_domainkey")
														? "DKIM"
														: record.value?.includes("v=spf1")
															? "SPF"
															: "TXT";

											return (
												<TableRow key={index}>
													<TableCell className="font-mono text-sm">
														{record.host || "@"}
													</TableCell>
													<TableCell>
														<Badge variant="outline">{recordType}</Badge>
													</TableCell>
													<TableCell className="max-w-md truncate font-mono text-xs">
														{record.value}
													</TableCell>
													<TableCell>
														{record.verified ? (
															<Badge variant="default" className="bg-green-500">
																<CheckCircle2 className="mr-1 h-3 w-3" />
																Verified
															</Badge>
														) : (
															<Badge variant="secondary">
																<XCircle className="mr-1 h-3 w-3" />
																Not Verified
															</Badge>
														)}
													</TableCell>
													<TableCell className="text-right">
														<Button
															variant="ghost"
															size="sm"
															onClick={() =>
																copyToClipboard(record.value, `${recordType} Record`)
															}
														>
															<Copy className="h-4 w-4" />
														</Button>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>
						</div>
					)}

					{/* A Records */}
					{dnsRecords.a && dnsRecords.a.length > 0 && (
						<div className="space-y-2">
							<h3 className="font-semibold">A Records</h3>
							<div className="rounded-md border">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Host</TableHead>
											<TableHead>IP Address</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Actions</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{dnsRecords.a.map((record, index) => (
											<TableRow key={index}>
												<TableCell className="font-mono text-sm">
													{record.host || "@"}
												</TableCell>
												<TableCell className="font-mono text-sm">
													{record.value}
												</TableCell>
												<TableCell>
													{record.verified ? (
														<Badge variant="default" className="bg-green-500">
															<CheckCircle2 className="mr-1 h-3 w-3" />
															Verified
														</Badge>
													) : (
														<Badge variant="secondary">
															<XCircle className="mr-1 h-3 w-3" />
															Not Verified
														</Badge>
													)}
												</TableCell>
												<TableCell className="text-right">
													<Button
														variant="ghost"
														size="sm"
														onClick={() =>
															copyToClipboard(record.value, "A Record")
														}
													>
														<Copy className="h-4 w-4" />
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</div>
						</div>
					)}

					{/* No Records */}
					{(!dnsRecords.mx || dnsRecords.mx.length === 0) &&
						(!dnsRecords.txt || dnsRecords.txt.length === 0) &&
						(!dnsRecords.a || dnsRecords.a.length === 0) && (
							<div className="flex h-32 items-center justify-center">
								<p className="text-muted-foreground">
									No DNS records detected. Please configure your DNS settings.
								</p>
							</div>
						)}
				</div>
			</CardContent>
		</Card>
	);
};

