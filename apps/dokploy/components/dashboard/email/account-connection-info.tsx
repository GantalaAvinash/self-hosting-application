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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/utils/api";
import { Copy, Mail, RefreshCw, Server } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface AccountConnectionInfoProps {
	emailAccountId: string;
	emailAddress: string;
}

export const AccountConnectionInfo = ({
	emailAccountId,
	emailAddress,
}: AccountConnectionInfoProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const { data: connectionInfo, isLoading } =
		api.email.getAccountConnectionInfo.useQuery(
			{ emailAccountId },
			{ enabled: isOpen && !!emailAccountId },
		);

	const copyToClipboard = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Server className="mr-2 h-4 w-4" />
					Connection Info
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Email Account Connection Information</DialogTitle>
					<DialogDescription>
						Use these settings to configure your email client for{" "}
						<strong>{emailAddress}</strong>
					</DialogDescription>
				</DialogHeader>
				{isLoading ? (
					<div className="flex h-48 items-center justify-center">
						<RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : connectionInfo ? (
					<div className="space-y-6">
						{/* Incoming Mail (IMAP) */}
						<Card>
							<CardHeader>
								<div className="flex items-center gap-2">
									<Mail className="h-5 w-5 text-primary" />
									<CardTitle className="text-lg">Incoming Mail (IMAP)</CardTitle>
								</div>
								<CardDescription>
									Configure your email client to receive emails
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Server</span>
										<div className="flex items-center gap-2">
											<code className="rounded bg-muted px-2 py-1 text-sm">
												{connectionInfo.imap?.host || "mail.example.com"}
											</code>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													copyToClipboard(
														connectionInfo.imap?.host || "",
														"IMAP Server",
													)
												}
											>
												<Copy className="h-4 w-4" />
											</Button>
										</div>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Port</span>
										<div className="flex items-center gap-2">
											<code className="rounded bg-muted px-2 py-1 text-sm">
												{connectionInfo.imap?.port || "993"}
											</code>
											<Badge variant="outline">SSL/TLS</Badge>
										</div>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Username</span>
										<div className="flex items-center gap-2">
											<code className="rounded bg-muted px-2 py-1 text-sm">
												{connectionInfo.imap?.username || emailAddress}
											</code>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													copyToClipboard(
														connectionInfo.imap?.username || emailAddress,
														"IMAP Username",
													)
												}
											>
												<Copy className="h-4 w-4" />
											</Button>
										</div>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Password</span>
										<span className="text-sm text-muted-foreground">
											Use your email account password
										</span>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Outgoing Mail (SMTP) */}
						<Card>
							<CardHeader>
								<div className="flex items-center gap-2">
									<Server className="h-5 w-5 text-primary" />
									<CardTitle className="text-lg">Outgoing Mail (SMTP)</CardTitle>
								</div>
								<CardDescription>
									Configure your email client to send emails
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-3">
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Server</span>
										<div className="flex items-center gap-2">
											<code className="rounded bg-muted px-2 py-1 text-sm">
												{connectionInfo.smtp?.host || "mail.example.com"}
											</code>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													copyToClipboard(
														connectionInfo.smtp?.host || "",
														"SMTP Server",
													)
												}
											>
												<Copy className="h-4 w-4" />
											</Button>
										</div>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Port</span>
										<div className="flex items-center gap-2">
											<code className="rounded bg-muted px-2 py-1 text-sm">
												{connectionInfo.smtp?.port || "587"}
											</code>
											<Badge variant="outline">STARTTLS</Badge>
										</div>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Username</span>
										<div className="flex items-center gap-2">
											<code className="rounded bg-muted px-2 py-1 text-sm">
												{connectionInfo.smtp?.username || emailAddress}
											</code>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													copyToClipboard(
														connectionInfo.smtp?.username || emailAddress,
														"SMTP Username",
													)
												}
											>
												<Copy className="h-4 w-4" />
											</Button>
										</div>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Password</span>
										<span className="text-sm text-muted-foreground">
											Use your email account password
										</span>
									</div>
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Authentication</span>
										<Badge variant="outline">Required</Badge>
									</div>
								</div>
							</CardContent>
						</Card>

						{/* Webmail Access */}
						{connectionInfo.webmail && (
							<Card>
								<CardHeader>
									<CardTitle className="text-lg">Webmail Access</CardTitle>
									<CardDescription>
										Access your email through a web browser
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="flex items-center justify-between">
										<span className="text-sm font-medium">Webmail URL</span>
										<div className="flex items-center gap-2">
											<code className="rounded bg-muted px-2 py-1 text-sm">
												{connectionInfo.webmail}
											</code>
											<Button
												variant="ghost"
												size="sm"
												onClick={() =>
													copyToClipboard(connectionInfo.webmail || "", "Webmail URL")
												}
											>
												<Copy className="h-4 w-4" />
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => window.open(connectionInfo.webmail, "_blank")}
											>
												Open
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						)}
					</div>
				) : (
					<div className="flex h-48 items-center justify-center">
						<p className="text-muted-foreground">
							Unable to load connection information
						</p>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
};

