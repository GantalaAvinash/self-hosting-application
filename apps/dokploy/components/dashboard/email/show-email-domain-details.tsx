import { AccountConnectionInfo } from "@/components/dashboard/email/account-connection-info";
import { AddEmailAccount } from "@/components/dashboard/email/add-email-account";
import { AddEmailAlias } from "@/components/dashboard/email/add-email-alias";
import { AddEmailForward } from "@/components/dashboard/email/add-email-forward";
import { BounceManagement } from "@/components/dashboard/email/bounce-management";
import { ComplaintManagement } from "@/components/dashboard/email/complaint-management";
import { DNSRecordsDisplay } from "@/components/dashboard/email/dns-records-display";
import { RateLimitStatus } from "@/components/dashboard/email/rate-limit-status";
import { ReputationDashboard } from "@/components/dashboard/email/reputation-dashboard";
import { SuppressionList } from "@/components/dashboard/email/suppression-list";
import { BreadcrumbSidebar } from "@/components/shared/breadcrumb-sidebar";
import { DateTooltip } from "@/components/shared/date-tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/utils/api";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  KeyRound,
  Mail,
  MailPlus,
  MoreHorizontalIcon,
  RefreshCw,
  TrashIcon,
  UserPlus
} from "lucide-react";
import { useRouter } from "next/router";
import { toast } from "sonner";

export const ShowEmailDomainDetails = () => {
	const router = useRouter();
	const { domainId } = router.query as { domainId: string };
	const utils = api.useUtils();

	const { data: member } = api.user.get.useQuery();
	const canCreateAccounts =
		member?.canManageEmailAccounts || member?.role !== "member";
	const canDeleteAccounts =
		member?.canManageEmailAccounts || member?.role !== "member";
	const canManageForwards =
		member?.canManageEmailForwards || member?.role !== "member";
	const canManageAliases =
		member?.canManageEmailAliases || member?.role !== "member";

	const { data: domain, isLoading } = api.email.getDomain.useQuery(
		{ emailDomainId: domainId },
		{ enabled: !!domainId },
	);

	const { data: accounts } = api.email.getAccountsByDomain.useQuery(
		{ emailDomainId: domainId },
		{ enabled: !!domainId },
	);

	const { data: forwards } = api.email.getForwardsByDomain.useQuery(
		{ emailDomainId: domainId },
		{ enabled: !!domainId },
	);

	const { data: aliases } = api.email.getAliasesByDomain.useQuery(
		{ emailDomainId: domainId },
		{ enabled: !!domainId },
	);

	const { mutateAsync: removeAccount } = api.email.removeAccount.useMutation();
	const { mutateAsync: removeForward } = api.email.removeForward.useMutation();
	const { mutateAsync: removeAlias } = api.email.removeAlias.useMutation();
	const { mutateAsync: verifyDns } = api.email.verifyDNS.useMutation();
	const { mutateAsync: generateDkim } = api.email.generateDKIM.useMutation();

	const copyToClipboard = (text: string, label: string) => {
		navigator.clipboard.writeText(text);
		toast.success(`${label} copied to clipboard`);
	};

	const handleVerifyDns = async () => {
		try {
			const result = await verifyDns({ emailDomainId: domainId });
			const allVerified = result.mx && result.spf && result.dkim && result.dmarc;
			if (allVerified) {
				toast.success("DNS records verified successfully");
				await utils.email.getDomain.invalidate({ emailDomainId: domainId });
			} else {
				const failed = [];
				if (!result.mx) failed.push("MX");
				if (!result.spf) failed.push("SPF");
				if (!result.dkim) failed.push("DKIM");
				if (!result.dmarc) failed.push("DMARC");
				toast.error(`DNS verification failed: ${failed.join(", ")}`);
			}
		} catch (error) {
			toast.error("Failed to verify DNS records");
		}
	};

	const handleGenerateDkim = async () => {
		try {
			await generateDkim({ emailDomainId: domainId });
			toast.success("DKIM keys generated successfully");
			await utils.email.getDomain.invalidate({ emailDomainId: domainId });
		} catch (error) {
			toast.error("Failed to generate DKIM keys");
		}
	};

	const handleRemoveAccount = async (emailAccountId: string) => {
		try {
			await removeAccount({ emailAccountId });
			await utils.email.getAccountsByDomain.invalidate({ emailDomainId: domainId });
			toast.success("Email account removed successfully");
		} catch (error) {
			toast.error("Failed to remove email account");
		}
	};

	const handleRemoveForward = async (emailForwardId: string) => {
		try {
			await removeForward({ emailForwardId });
			await utils.email.getForwardsByDomain.invalidate({ emailDomainId: domainId });
			toast.success("Email forward removed successfully");
		} catch (error) {
			toast.error("Failed to remove email forward");
		}
	};

	const handleRemoveAlias = async (emailAliasId: string) => {
		try {
			await removeAlias({ emailAliasId });
			await utils.email.getAliasesByDomain.invalidate({ emailDomainId: domainId });
			toast.success("Email alias removed successfully");
		} catch (error) {
			toast.error("Failed to remove email alias");
		}
	};

	if (isLoading || !domain) {
		return (
			<div className="flex h-screen items-center justify-center">
				<RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-full w-full flex-col gap-4">
			<BreadcrumbSidebar
				list={[
					{ name: "Dashboard", href: "/dashboard" },
					{ name: "Email Hosting", href: "/dashboard/email" },
					{ name: domain.domain },
				]}
			/>

			<div className="flex flex-col gap-6">
				{/* Domain Header */}
				<div>
					<div className="flex items-start justify-between">
						<div>
							<h1 className="text-3xl font-bold">{domain.domain}</h1>
							{domain.description && (
								<p className="mt-1 text-muted-foreground">{domain.description}</p>
							)}
						</div>
						<div className="flex items-center gap-2">
							<Button 
								variant="default" 
								size="sm" 
								onClick={() => window.open('http://localhost:8080', '_blank')}
							>
								<Mail className="mr-2 h-4 w-4" />
								Access Webmail
							</Button>
							<Button variant="secondary" size="sm" onClick={handleVerifyDns}>
								<RefreshCw className="h-4 w-4" />
								Verify DNS
							</Button>
							<Badge
								variant={
									domain.status === "active"
										? "default"
										: domain.status === "pending"
											? "secondary"
											: "destructive"
								}
							>
								{domain.status}
							</Badge>
							{domain.dnsVerified ? (
								<Badge variant="outline" className="text-green-600">
									<CheckCircle2 className="mr-1 h-3 w-3" />
									DNS Verified
								</Badge>
							) : (
								<Badge variant="outline" className="text-yellow-600">
									<AlertCircle className="mr-1 h-3 w-3" />
									DNS Unverified
								</Badge>
							)}
						</div>
					</div>
				</div>

				{/* DNS Configuration Card */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle>DNS Configuration</CardTitle>
								<CardDescription>
									Add these records to your DNS provider
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={handleGenerateDkim}
								disabled={!!domain.dkimPrivateKey}
							>
								<KeyRound className="h-4 w-4" />
								{domain.dkimPrivateKey ? "DKIM Generated" : "Generate DKIM"}
							</Button>
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* MX Record */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-semibold">MX Record</Label>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										copyToClipboard(
											`mail.${domain.domain}`,
											"MX Record",
										)
									}
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
							<code className="block rounded-md bg-muted p-3 text-sm">
								Type: MX | Host: @ | Value: mail.{domain.domain} | Priority: 10
							</code>
						</div>

						{/* A Record */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-semibold">A Record</Label>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										copyToClipboard("mail", "A Record")
									}
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
							<code className="block rounded-md bg-muted p-3 text-sm">
								Type: A | Host: mail | Value: {domain.mailServerIp || domain.server?.ipAddress || "YOUR_SERVER_IP"}
							</code>
						</div>

						{/* SPF Record */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-semibold">SPF Record</Label>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										copyToClipboard("v=spf1 mx ~all", "SPF Record")
									}
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
							<code className="block rounded-md bg-muted p-3 text-sm">
								Type: TXT | Host: @ | Value: v=spf1 mx ~all
							</code>
						</div>

						{/* DKIM Record */}
						{domain.dkimPublicKey && (
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label className="text-sm font-semibold">DKIM Record</Label>
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											copyToClipboard(domain.dkimPublicKey || "", "DKIM Key")
										}
									>
										<Copy className="h-4 w-4" />
									</Button>
								</div>
								<code className="block max-h-32 overflow-auto rounded-md bg-muted p-3 text-xs">
									Type: TXT | Host: {domain.dkimSelector || "mail"}._domainkey |
									Value: {domain.dkimPublicKey}
								</code>
							</div>
						)}

						{/* DMARC Record */}
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-sm font-semibold">DMARC Record</Label>
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										copyToClipboard(
											`v=DMARC1; p=quarantine; rua=mailto:postmaster@${domain.domain}`,
											"DMARC Record",
										)
									}
								>
									<Copy className="h-4 w-4" />
								</Button>
							</div>
							<code className="block rounded-md bg-muted p-3 text-sm">
								Type: TXT | Host: _dmarc | Value: v=DMARC1; p=quarantine;
								rua=mailto:postmaster@{domain.domain}
							</code>
						</div>

						{/* Webmail Configuration (Optional) */}
						{domain.webmailUrl && (
							<div className="space-y-2">
								<div className="flex items-center justify-between">
									<Label className="text-sm font-semibold">Webmail Configuration</Label>
									<Button
										variant="ghost"
										size="sm"
										onClick={() =>
											copyToClipboard(
												domain.webmailUrl || "",
												"Webmail URL",
											)
										}
									>
										<Copy className="h-4 w-4" />
									</Button>
								</div>
								<code className="block rounded-md bg-muted p-3 text-sm">
									Webmail URL: {domain.webmailUrl}
								</code>
								<p className="text-xs text-muted-foreground">
									Configure your subdomain (e.g., webmail.{domain.domain}) to point to this webmail interface
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* DNS Records Display */}
				<DNSRecordsDisplay emailDomainId={domainId} />

				{/* Email Management Tabs */}
				<Tabs defaultValue="accounts" className="w-full">
					<TabsList className="grid w-full grid-cols-6">
						<TabsTrigger value="accounts">
							Email Accounts ({accounts?.length || 0})
						</TabsTrigger>
						<TabsTrigger value="forwards">
							Forwards ({forwards?.length || 0})
						</TabsTrigger>
						<TabsTrigger value="aliases">
							Aliases ({aliases?.length || 0})
						</TabsTrigger>
						<TabsTrigger value="reputation">Reputation</TabsTrigger>
						<TabsTrigger value="deliverability">Deliverability</TabsTrigger>
						<TabsTrigger value="settings">Settings</TabsTrigger>
					</TabsList>

					{/* Email Accounts Tab */}
					<TabsContent value="accounts" className="space-y-4">
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								Manage email accounts for this domain
							</p>
							{canCreateAccounts && (
								<AddEmailAccount domainId={domainId} domain={domain.domain} />
							)}
						</div>
						{accounts && accounts.length > 0 ? (
							<div className="grid gap-4 md:grid-cols-2">
								{accounts.map((account) => (
									<Card key={account.emailAccountId}>
										<CardHeader className="pb-3">
											<div className="flex items-start justify-between">
												<div className="flex flex-col gap-1">
													<CardTitle className="text-lg">
														{account.username}@{domain.domain}
													</CardTitle>
													{account.fullName && (
														<CardDescription>{account.fullName}</CardDescription>
													)}
												</div>
												<DropdownMenu>
													<DropdownMenuTrigger asChild>
														<Button variant="ghost" size="icon" className="h-8 w-8">
															<MoreHorizontalIcon className="h-4 w-4" />
														</Button>
													</DropdownMenuTrigger>
													<DropdownMenuContent align="end">
														<DropdownMenuLabel>Actions</DropdownMenuLabel>
														<DropdownMenuSeparator />
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<DropdownMenuItem
																	onSelect={(e) => e.preventDefault()}
																	className="text-destructive focus:text-destructive"
																	disabled={!canDeleteAccounts}
																>
																	<TrashIcon className="mr-2 h-4 w-4" />
																	Delete Account
																</DropdownMenuItem>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>
																		Delete email account?
																	</AlertDialogTitle>
																	<AlertDialogDescription>
																		This will permanently delete{" "}
																		<strong>
																			{account.username}@{domain.domain}
																		</strong>{" "}
																		and all emails. This action cannot be undone.
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>Cancel</AlertDialogCancel>
																	<AlertDialogAction
																		onClick={() =>
																			handleRemoveAccount(account.emailAccountId)
																		}
																		className="bg-destructive hover:bg-destructive/90"
																	>
																		Delete
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													</DropdownMenuContent>
												</DropdownMenu>
											</div>
										</CardHeader>
										<CardContent>
											<div className="space-y-2 text-sm">
												<div className="flex justify-between">
													<span className="text-muted-foreground">Quota</span>
													<span>
														{account.quota
															? `${account.quota / 1024}GB`
															: "Unlimited"}
													</span>
												</div>
												<div className="flex justify-between">
													<span className="text-muted-foreground">Status</span>
													<Badge
														variant={
															account.enabled ? "default" : "secondary"
														}
													>
														{account.enabled ? "Active" : "Disabled"}
													</Badge>
												</div>
												<div className="flex justify-between text-xs text-muted-foreground">
													<span>Created</span>
													<DateTooltip date={account.createdAt} />
												</div>
												<div className="mt-3 pt-3 border-t">
													<AccountConnectionInfo
														emailAccountId={account.emailAccountId}
														emailAddress={`${account.username}@${domain.domain}`}
													/>
												</div>
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						) : (
							<Card className="flex h-48 items-center justify-center">
								<CardContent className="flex flex-col items-center gap-4">
									<Mail className="h-12 w-12 text-muted-foreground" />
									<div className="text-center">
										<h3 className="font-semibold">No email accounts</h3>
										<p className="text-sm text-muted-foreground">
											Create your first email account
										</p>
									</div>
									{canCreateAccounts && (
										<AddEmailAccount domainId={domainId} domain={domain.domain} />
									)}
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* Email Forwards Tab */}
					<TabsContent value="forwards" className="space-y-4">
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								Forward emails from one address to another
							</p>
							<AddEmailForward domainId={domainId} domain={domain.domain} />
						</div>
						{forwards && forwards.length > 0 ? (
							<div className="space-y-2">
								{forwards.map((forward) => (
									<Card key={forward.emailForwardId}>
										<CardContent className="flex items-center justify-between py-4">
											<div className="flex items-center gap-4">
												<MailPlus className="h-5 w-5 text-muted-foreground" />
												<div>
													<p className="font-medium">
														{forward.sourceAddress}@{domain.domain}
													</p>
													<p className="text-sm text-muted-foreground">
														→ {forward.destinationAddress}
													</p>
												</div>
											</div>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button variant="ghost" size="icon">
														<TrashIcon className="h-4 w-4 text-destructive" />
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete forward?</AlertDialogTitle>
														<AlertDialogDescription>
															This will stop forwarding emails from{" "}
															<strong>
																{forward.sourceAddress}@{domain.domain}
															</strong>{" "}
															to <strong>{forward.destinationAddress}</strong>.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={() =>
																handleRemoveForward(forward.emailForwardId)
															}
															className="bg-destructive hover:bg-destructive/90"
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</CardContent>
									</Card>
								))}
							</div>
						) : (
							<Card className="flex h-48 items-center justify-center">
								<CardContent className="flex flex-col items-center gap-4">
									<MailPlus className="h-12 w-12 text-muted-foreground" />
									<div className="text-center">
										<h3 className="font-semibold">No email forwards</h3>
										<p className="text-sm text-muted-foreground">
											Create your first email forward
										</p>
									</div>
									{canManageForwards && (
										<AddEmailForward domainId={domainId} domain={domain.domain} />
									)}
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* Email Aliases Tab */}
					<TabsContent value="aliases" className="space-y-4">
						<div className="flex items-center justify-between">
							<p className="text-sm text-muted-foreground">
								Create alternate email addresses for existing accounts
							</p>
							<AddEmailAlias domainId={domainId} domain={domain.domain} />
						</div>
						{aliases && aliases.length > 0 ? (
							<div className="space-y-2">
								{aliases.map((alias) => (
									<Card key={alias.emailAliasId}>
										<CardContent className="flex items-center justify-between py-4">
											<div className="flex items-center gap-4">
												<UserPlus className="h-5 w-5 text-muted-foreground" />
												<div>
													<p className="font-medium">
														{alias.aliasAddress}@{domain.domain}
													</p>
													<p className="text-sm text-muted-foreground">
														Alias for {(alias.emailAccount as any)?.username}@{domain.domain}
													</p>
												</div>
											</div>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button variant="ghost" size="icon">
														<TrashIcon className="h-4 w-4 text-destructive" />
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete alias?</AlertDialogTitle>
														<AlertDialogDescription>
															This will remove the alias{" "}
															<strong>
																{alias.aliasAddress}@{domain.domain}
															</strong>
															. Emails sent to this address will no longer be delivered.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction
															onClick={() =>
																handleRemoveAlias(alias.emailAliasId)
															}
															className="bg-destructive hover:bg-destructive/90"
														>
															Delete
														</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</CardContent>
									</Card>
								))}
							</div>
						) : (
							<Card className="flex h-48 items-center justify-center">
								<CardContent className="flex flex-col items-center gap-4">
									<UserPlus className="h-12 w-12 text-muted-foreground" />
									<div className="text-center">
										<h3 className="font-semibold">No email aliases</h3>
										<p className="text-sm text-muted-foreground">
											Create your first email alias
										</p>
									</div>
									{canManageAliases && (
										<AddEmailAlias domainId={domainId} domain={domain.domain} />
									)}
								</CardContent>
							</Card>
						)}
					</TabsContent>

					{/* Reputation Tab */}
					<TabsContent value="reputation" className="space-y-4">
						<ReputationDashboard emailDomainId={domainId} />
					</TabsContent>

					{/* Deliverability Tab */}
					<TabsContent value="deliverability" className="space-y-4">
						<div className="space-y-6">
							<BounceManagement emailDomainId={domainId} />
							<ComplaintManagement emailDomainId={domainId} />
							<SuppressionList emailDomainId={domainId} />
							<RateLimitStatus emailDomainId={domainId} />
						</div>
					</TabsContent>

					{/* Settings Tab */}
					<TabsContent value="settings" className="space-y-4">
						<Card>
							<CardHeader>
								<CardTitle>Domain Settings</CardTitle>
								<CardDescription>
									Configure rate limits and deliverability settings
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-4">
								<RateLimitStatus emailDomainId={domainId} />
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
};
