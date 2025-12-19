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
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { api } from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { Gauge, RefreshCw, Settings } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface RateLimitStatusProps {
	emailDomainId: string;
	emailAccountId?: string;
}

const setRateLimitSchema = z.object({
	limitType: z.enum(["daily", "hourly", "per_minute"]),
	limitValue: z.number().min(1, "Limit must be at least 1"),
});

type SetRateLimitForm = z.infer<typeof setRateLimitSchema>;

export const RateLimitStatus = ({
	emailDomainId,
	emailAccountId,
}: RateLimitStatusProps) => {
	const utils = api.useUtils();
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [selectedLimitType, setSelectedLimitType] = useState<
		"daily" | "hourly" | "per_minute"
	>("daily");

	const { data: dailyStatus } = api.email.getRateLimitStatus.useQuery(
		{ emailDomainId, emailAccountId, limitType: "daily" },
		{ enabled: !!emailDomainId },
	);

	const { data: hourlyStatus } = api.email.getRateLimitStatus.useQuery(
		{ emailDomainId, emailAccountId, limitType: "hourly" },
		{ enabled: !!emailDomainId },
	);

	const { data: perMinuteStatus } = api.email.getRateLimitStatus.useQuery(
		{ emailDomainId, emailAccountId, limitType: "per_minute" },
		{ enabled: !!emailDomainId },
	);

	const { mutateAsync: setRateLimit } = api.email.setRateLimit.useMutation();

	const form = useForm<SetRateLimitForm>({
		resolver: zodResolver(setRateLimitSchema),
		defaultValues: {
			limitType: "daily",
			limitValue: 1000,
		},
	});

	const handleSetRateLimit = async (data: SetRateLimitForm) => {
		try {
			await setRateLimit({
				emailDomainId,
				emailAccountId,
				limitType: data.limitType,
				limitValue: data.limitValue,
			});
			await utils.email.getRateLimitStatus.invalidate();
			form.reset();
			setIsDialogOpen(false);
			toast.success("Rate limit updated successfully");
		} catch (error) {
			toast.error("Failed to update rate limit");
		}
	};

	const handleRefresh = async () => {
		await utils.email.getRateLimitStatus.invalidate();
		toast.success("Rate limit data refreshed");
	};

	const getStatus = (status?: { current: number; limit: number; resetAt: string }) => {
		if (!status) return null;
		const percentage = (status.current / status.limit) * 100;
		const isNearLimit = percentage >= 80;
		const isAtLimit = percentage >= 100;

		return {
			...status,
			percentage,
			isNearLimit,
			isAtLimit,
		};
	};

	const daily = getStatus(dailyStatus);
	const hourly = getStatus(hourlyStatus);
	const perMinute = getStatus(perMinuteStatus);

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Rate Limit Status</CardTitle>
							<CardDescription>
								Monitor email sending rate limits
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleRefresh}>
								<RefreshCw className="mr-2 h-4 w-4" />
								Refresh
							</Button>
							<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
								<DialogTrigger asChild>
									<Button size="sm" variant="outline">
										<Settings className="mr-2 h-4 w-4" />
										Configure
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Configure Rate Limit</DialogTitle>
										<DialogDescription>
											Set custom rate limits for this{" "}
											{emailAccountId ? "account" : "domain"}.
										</DialogDescription>
									</DialogHeader>
									<Form {...form}>
										<form
											onSubmit={form.handleSubmit(handleSetRateLimit)}
											className="space-y-4"
										>
											<FormField
												control={form.control}
												name="limitType"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Limit Type</FormLabel>
														<Select
															onValueChange={(value) => {
																field.onChange(value);
																setSelectedLimitType(
																	value as "daily" | "hourly" | "per_minute",
																);
															}}
															defaultValue={field.value}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue placeholder="Select limit type" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																<SelectItem value="daily">Daily</SelectItem>
																<SelectItem value="hourly">Hourly</SelectItem>
																<SelectItem value="per_minute">
																	Per Minute
																</SelectItem>
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="limitValue"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Limit Value</FormLabel>
														<FormControl>
															<Input
																type="number"
																min={1}
																placeholder="1000"
																{...field}
																onChange={(e) =>
																	field.onChange(Number(e.target.value))
																}
															/>
														</FormControl>
														<FormDescription>
															Maximum number of emails allowed per{" "}
															{selectedLimitType.replace("_", " ")}
														</FormDescription>
														<FormMessage />
													</FormItem>
												)}
											/>
											<DialogFooter>
												<Button
													type="button"
													variant="outline"
													onClick={() => setIsDialogOpen(false)}
												>
													Cancel
												</Button>
												<Button type="submit">Update Limit</Button>
											</DialogFooter>
										</form>
									</Form>
								</DialogContent>
							</Dialog>
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Daily Limit */}
					{daily && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Gauge className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium">Daily Limit</span>
								</div>
								<Badge
									variant={
										daily.isAtLimit
											? "destructive"
											: daily.isNearLimit
												? "secondary"
												: "default"
									}
								>
									{daily.current} / {daily.limit}
								</Badge>
							</div>
							<Progress
								value={daily.percentage}
								className={
									daily.isAtLimit
										? "h-3"
										: daily.isNearLimit
											? "h-3"
											: "h-3"
								}
							/>
							<p className="text-xs text-muted-foreground">
								Resets at {new Date(daily.resetAt).toLocaleString()}
							</p>
						</div>
					)}

					{/* Hourly Limit */}
					{hourly && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Gauge className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium">Hourly Limit</span>
								</div>
								<Badge
									variant={
										hourly.isAtLimit
											? "destructive"
											: hourly.isNearLimit
												? "secondary"
												: "default"
									}
								>
									{hourly.current} / {hourly.limit}
								</Badge>
							</div>
							<Progress
								value={hourly.percentage}
								className={
									hourly.isAtLimit
										? "h-3"
										: hourly.isNearLimit
											? "h-3"
											: "h-3"
								}
							/>
							<p className="text-xs text-muted-foreground">
								Resets at {new Date(hourly.resetAt).toLocaleString()}
							</p>
						</div>
					)}

					{/* Per Minute Limit */}
					{perMinute && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Gauge className="h-4 w-4 text-muted-foreground" />
									<span className="font-medium">Per Minute Limit</span>
								</div>
								<Badge
									variant={
										perMinute.isAtLimit
											? "destructive"
											: perMinute.isNearLimit
												? "secondary"
												: "default"
									}
								>
									{perMinute.current} / {perMinute.limit}
								</Badge>
							</div>
							<Progress
								value={perMinute.percentage}
								className={
									perMinute.isAtLimit
										? "h-3"
										: perMinute.isNearLimit
											? "h-3"
											: "h-3"
								}
							/>
							<p className="text-xs text-muted-foreground">
								Resets at {new Date(perMinute.resetAt).toLocaleString()}
							</p>
						</div>
					)}

					{/* Alerts */}
					{daily?.isAtLimit && (
						<div className="rounded-lg border border-red-500 bg-red-50 p-3 dark:bg-red-950">
							<p className="text-sm text-red-900 dark:text-red-100">
								Daily rate limit reached. Sending is blocked until reset.
							</p>
						</div>
					)}
					{hourly?.isAtLimit && (
						<div className="rounded-lg border border-yellow-500 bg-yellow-50 p-3 dark:bg-yellow-950">
							<p className="text-sm text-yellow-900 dark:text-yellow-100">
								Hourly rate limit reached. Sending is blocked until reset.
							</p>
						</div>
					)}
					{perMinute?.isAtLimit && (
						<div className="rounded-lg border border-orange-500 bg-orange-50 p-3 dark:bg-orange-950">
							<p className="text-sm text-orange-900 dark:text-orange-100">
								Per-minute rate limit reached. Sending is blocked until reset.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

