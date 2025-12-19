import { AddEmailDomain } from "@/components/dashboard/email/add-email-domain";
import { MailServerHealth } from "@/components/dashboard/email/mail-server-health";
import { BreadcrumbSidebar } from "@/components/shared/breadcrumb-sidebar";
import { DateTooltip } from "@/components/shared/date-tooltip";
import { FocusShortcutInput } from "@/components/shared/focus-shortcut-input";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/utils/api";
import { useDebounce } from "@/utils/hooks/use-debounce";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLinkIcon,
  Mail,
  MoreHorizontalIcon,
  Search,
  ServerIcon,
  TrashIcon,
  XCircle
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export const ShowEmailDomains = () => {
	const utils = api.useUtils();
	const { data, isLoading, error } = api.email.getAllDomains.useQuery(undefined, {
		retry: 1,
	});
	const { mutateAsync: removeDomain } = api.email.removeDomain.useMutation();
	const { mutateAsync: verifyDns } = api.email.verifyDNS.useMutation();
	const { data: member } = api.user.get.useQuery();

	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearchQuery = useDebounce(searchQuery, 500);

	const canCreateDomains =
		member?.canCreateEmailDomains || member?.role !== "member";
	const canDeleteDomains =
		member?.canDeleteEmailDomains || member?.role !== "member";

	const filteredDomains = (data || []).filter((domain) =>
		domain.domain.toLowerCase().includes(debouncedSearchQuery.toLowerCase()),
	);

	const handleRemoveDomain = async (emailDomainId: string) => {
		try {
			await removeDomain({ emailDomainId });
			await utils.email.getAllDomains.invalidate();
			toast.success("Email domain removed successfully");
		} catch (error) {
			toast.error("Failed to remove email domain");
		}
	};

	const handleVerifyDns = async (emailDomainId: string) => {
		try {
			const result = await verifyDns({ emailDomainId });
			const allVerified = result.mx && result.spf && result.dkim && result.dmarc;
			if (allVerified) {
				toast.success("DNS records verified successfully");
				await utils.email.getAllDomains.invalidate();
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

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "active":
				return <CheckCircle2 className="h-4 w-4 text-green-500" />;
			case "pending":
				return <AlertCircle className="h-4 w-4 text-yellow-500" />;
			case "disabled":
				return <XCircle className="h-4 w-4 text-red-500" />;
			default:
				return null;
		}
	};

	return (
		<div className="flex h-full w-full flex-col gap-4">
			<BreadcrumbSidebar
				list={[
					{ name: "Dashboard", href: "/dashboard" },
					{ name: "Email Hosting" },
				]}
			/>

			<div className="flex w-full flex-col gap-4">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl font-bold">Email Hosting</h1>
						<p className="text-sm text-muted-foreground">
							Manage your email domains and accounts
						</p>
					</div>
					{canCreateDomains && <AddEmailDomain />}
				</div>

				{/* Mail Server Health */}
				<MailServerHealth />

				<div className="flex items-center gap-2">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
						<FocusShortcutInput
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search domains..."
							className="pl-10"
						/>
					</div>
				</div>

				{error ? (
					<Card className="flex h-48 flex-col items-center justify-center border-destructive">
						<CardContent className="flex flex-col items-center gap-4 pt-6">
							<AlertCircle className="h-12 w-12 text-destructive" />
							<div className="text-center">
								<h3 className="font-semibold text-destructive">Error loading email domains</h3>
								<p className="text-sm text-muted-foreground">
									{error.message || "Failed to load email domains. Please try again."}
								</p>
							</div>
						</CardContent>
					</Card>
				) : isLoading ? (
					<div className="flex h-48 items-center justify-center">
						<div className="text-center">
							<ServerIcon className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
							<p className="mt-2 text-sm text-muted-foreground">Loading domains...</p>
						</div>
					</div>
				) : filteredDomains && filteredDomains.length > 0 ? (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{filteredDomains.map((domain) => (
							<Card key={domain.emailDomainId} className="relative">
								<CardHeader className="pb-3">
									<div className="flex items-start justify-between">
										<div className="flex items-center gap-2">
											<Mail className="h-5 w-5 text-primary" />
											<CardTitle className="text-lg">{domain.domain}</CardTitle>
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
												<DropdownMenuGroup>
													<DropdownMenuItem asChild>
														<Link href={`/dashboard/email/${domain.emailDomainId}`}>
															<ExternalLinkIcon className="mr-2 h-4 w-4" />
															Manage Domain
														</Link>
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => handleVerifyDns(domain.emailDomainId)}
													>
														<CheckCircle2 className="mr-2 h-4 w-4" />
														Verify DNS
													</DropdownMenuItem>
												</DropdownMenuGroup>
												<DropdownMenuSeparator />
												{canDeleteDomains && (
													<AlertDialog>
														<AlertDialogTrigger asChild>
															<DropdownMenuItem
																onSelect={(e) => e.preventDefault()}
																className="text-destructive focus:text-destructive"
															>
																<TrashIcon className="mr-2 h-4 w-4" />
																Delete Domain
															</DropdownMenuItem>
														</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>
																Are you absolutely sure?
															</AlertDialogTitle>
															<AlertDialogDescription>
																This will permanently delete the email domain{" "}
																<strong>{domain.domain}</strong> and all associated
																email accounts, forwards, and aliases. This action
																cannot be undone.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																onClick={() => handleRemoveDomain(domain.emailDomainId)}
																className="bg-destructive hover:bg-destructive/90"
															>
																Delete
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
												)}
											</DropdownMenuContent>
										</DropdownMenu>
									</div>
									{domain.description && (
										<CardDescription className="line-clamp-2">
											{domain.description}
										</CardDescription>
									)}
								</CardHeader>
								<CardContent className="space-y-3">
									<div className="flex items-center justify-between text-sm">
										<span className="text-muted-foreground">Status</span>
										<div className="flex items-center gap-1">
											{getStatusIcon(domain.status)}
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
										</div>
									</div>

									{domain.dnsVerified && (
										<div className="flex items-center justify-between text-sm">
											<span className="text-muted-foreground">DNS</span>
											<Badge variant="outline" className="text-green-600">
												<CheckCircle2 className="mr-1 h-3 w-3" />
												Verified
											</Badge>
										</div>
									)}

									{!domain.dnsVerified && (
										<div className="flex items-center justify-between text-sm">
											<span className="text-muted-foreground">DNS</span>
											<Badge variant="outline" className="text-yellow-600">
												<AlertCircle className="mr-1 h-3 w-3" />
												Unverified
											</Badge>
										</div>
									)}

									{domain.dkimSelector && (
										<div className="flex flex-col gap-1 text-sm">
											<span className="text-muted-foreground">DKIM Selector</span>
											<code className="rounded bg-muted px-2 py-1 text-xs">
												{domain.dkimSelector}
											</code>
										</div>
									)}
								</CardContent>
								<CardFooter className="border-t pt-3 text-xs text-muted-foreground">
									<div className="flex w-full items-center justify-between">
										<span>Created</span>
										<DateTooltip date={domain.createdAt} />
									</div>
								</CardFooter>
							</Card>
						))}
					</div>
				) : (
					<Card className="flex h-48 flex-col items-center justify-center">
						<CardContent className="flex flex-col items-center gap-4 pt-6">
							<Mail className="h-12 w-12 text-muted-foreground" />
							<div className="text-center">
								<h3 className="font-semibold">No email domains yet</h3>
								<p className="text-sm text-muted-foreground">
									{debouncedSearchQuery
										? "No domains found matching your search"
										: "Get started by adding your first email domain"}
								</p>
							</div>
							{!debouncedSearchQuery && <AddEmailDomain />}
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
};
