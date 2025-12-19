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
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, Plus, RefreshCw, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

interface SuppressionListProps {
	emailDomainId: string;
}

const addSuppressionSchema = z.object({
	emailAddress: z.string().email("Invalid email address"),
	suppressionType: z.enum(["bounce", "complaint", "unsubscribe", "manual"]),
	reason: z.string().optional(),
});

type AddSuppressionForm = z.infer<typeof addSuppressionSchema>;

export const SuppressionList = ({ emailDomainId }: SuppressionListProps) => {
	const utils = api.useUtils();
	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const { data: suppressions, isLoading } = api.email.getSuppressions.useQuery(
		{ emailDomainId },
		{ enabled: !!emailDomainId },
	);

	const { mutateAsync: addSuppression } = api.email.addSuppression.useMutation();
	const { mutateAsync: removeSuppression } =
		api.email.removeSuppression.useMutation();

	const form = useForm<AddSuppressionForm>({
		resolver: zodResolver(addSuppressionSchema),
		defaultValues: {
			suppressionType: "manual",
		},
	});

	const handleAddSuppression = async (data: AddSuppressionForm) => {
		try {
			await addSuppression({
				emailDomainId,
				emailAddress: data.emailAddress,
				suppressionType: data.suppressionType,
				reason: data.reason,
			});
			await utils.email.getSuppressions.invalidate();
			form.reset();
			setIsDialogOpen(false);
			toast.success("Email added to suppression list");
		} catch (error) {
			toast.error("Failed to add suppression");
		}
	};

	const handleRemoveSuppression = async (emailAddress: string) => {
		try {
			await removeSuppression({ emailDomainId, emailAddress });
			await utils.email.getSuppressions.invalidate();
			toast.success("Email removed from suppression list");
		} catch (error) {
			toast.error("Failed to remove suppression");
		}
	};

	const handleRefresh = async () => {
		await utils.email.getSuppressions.invalidate();
		toast.success("Suppression list refreshed");
	};

	const getSuppressionTypeColor = (type: string) => {
		switch (type) {
			case "bounce":
				return "destructive";
			case "complaint":
				return "destructive";
			case "unsubscribe":
				return "secondary";
			case "manual":
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
							<CardTitle>Suppression List</CardTitle>
							<CardDescription>
								Emails that will not receive messages from this domain
							</CardDescription>
						</div>
						<div className="flex items-center gap-2">
							<Button variant="outline" size="sm" onClick={handleRefresh}>
								<RefreshCw className="mr-2 h-4 w-4" />
								Refresh
							</Button>
							<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
								<DialogTrigger asChild>
									<Button size="sm">
										<Plus className="mr-2 h-4 w-4" />
										Add Suppression
									</Button>
								</DialogTrigger>
								<DialogContent>
									<DialogHeader>
										<DialogTitle>Add to Suppression List</DialogTitle>
										<DialogDescription>
											Add an email address to the suppression list. This email
											will not receive any messages from this domain.
										</DialogDescription>
									</DialogHeader>
									<Form {...form}>
										<form
											onSubmit={form.handleSubmit(handleAddSuppression)}
											className="space-y-4"
										>
											<FormField
												control={form.control}
												name="emailAddress"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Email Address</FormLabel>
														<FormControl>
															<Input
																placeholder="user@example.com"
																{...field}
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="suppressionType"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Reason</FormLabel>
														<Select
															onValueChange={field.onChange}
															defaultValue={field.value}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue placeholder="Select reason" />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																<SelectItem value="manual">Manual</SelectItem>
																<SelectItem value="bounce">Bounce</SelectItem>
																<SelectItem value="complaint">Complaint</SelectItem>
																<SelectItem value="unsubscribe">
																	Unsubscribe
																</SelectItem>
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>
											<FormField
												control={form.control}
												name="reason"
												render={({ field }) => (
													<FormItem>
														<FormLabel>Reason (Optional)</FormLabel>
														<FormControl>
															<Input
																placeholder="Additional details..."
																{...field}
															/>
														</FormControl>
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
												<Button type="submit">Add Suppression</Button>
											</DialogFooter>
										</form>
									</Form>
								</DialogContent>
							</Dialog>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{suppressions && suppressions.length > 0 ? (
						<div className="rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Email Address</TableHead>
										<TableHead>Type</TableHead>
										<TableHead>Reason</TableHead>
										<TableHead>Suppressed At</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{suppressions.map((suppression) => (
										<TableRow key={suppression.suppressionId}>
											<TableCell className="font-medium">
												{suppression.emailAddress}
											</TableCell>
											<TableCell>
												<Badge
													variant={getSuppressionTypeColor(
														suppression.suppressionType,
													)}
												>
													{suppression.suppressionType}
												</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{suppression.reason || "N/A"}
											</TableCell>
											<TableCell>
												<DateTooltip date={suppression.suppressedAt} />
											</TableCell>
											<TableCell className="text-right">
												<AlertDialog>
													<AlertDialogTrigger asChild>
														<Button
															variant="ghost"
															size="sm"
															className="text-destructive hover:text-destructive"
														>
															<TrashIcon className="h-4 w-4" />
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>
																Remove from Suppression List?
															</AlertDialogTitle>
															<AlertDialogDescription>
																This will allow{" "}
																<strong>{suppression.emailAddress}</strong> to
																receive emails from this domain again. This action
																cannot be undone.
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																onClick={() =>
																	handleRemoveSuppression(
																		suppression.emailAddress,
																	)
																}
																className="bg-destructive hover:bg-destructive/90"
															>
																Remove
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					) : (
						<Card className="flex h-32 items-center justify-center">
							<div className="text-center">
								<Ban className="mx-auto h-8 w-8 text-muted-foreground" />
								<p className="mt-2 text-muted-foreground">
									No suppressions in list
								</p>
							</div>
						</Card>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

