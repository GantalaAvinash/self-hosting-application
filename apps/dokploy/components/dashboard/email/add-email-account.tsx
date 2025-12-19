import { AlertBlock } from "@/components/shared/alert-block";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { api } from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const AddEmailAccountSchema = z.object({
	username: z
		.string()
		.min(1, "Username is required")
		.regex(
			/^[a-z0-9._-]+$/,
			"Username can only contain lowercase letters, numbers, dots, hyphens, and underscores",
		),
	password: z.string().min(8, "Password must be at least 8 characters"),
	confirmPassword: z.string(),
	fullName: z.string().optional(),
	quota: z.number().min(0).optional(),
	enabled: z.boolean().default(true),
}).refine((data) => data.password === data.confirmPassword, {
	message: "Passwords do not match",
	path: ["confirmPassword"],
});

type AddEmailAccount = z.infer<typeof AddEmailAccountSchema>;

interface Props {
	domainId: string;
	domain: string;
}

export const AddEmailAccount = ({ domainId, domain }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { mutateAsync, error, isError } = api.email.createAccount.useMutation();

	const form = useForm<AddEmailAccount>({
		defaultValues: {
			username: "",
			password: "",
			confirmPassword: "",
			fullName: "",
			quota: 5120, // 5GB default
			enabled: true,
		},
		resolver: zodResolver(AddEmailAccountSchema),
	});

	const onSubmit = async (data: AddEmailAccount) => {
		await mutateAsync({
			emailDomainId: domainId,
			username: data.username.toLowerCase().trim(),
			password: data.password,
			fullName: data.fullName,
			quota: data.quota,
			enabled: data.enabled,
		})
			.then(async () => {
				await utils.email.getAccountsByDomain.invalidate({ emailDomainId: domainId });
				toast.success("Email account created successfully");
				setIsOpen(false);
				form.reset();
			})
			.catch(() => {
				toast.error("Error creating email account");
			});
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon className="h-4 w-4" />
					Add Account
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Email Account</DialogTitle>
					<DialogDescription>
						Create a new email account for <strong>{domain}</strong>
					</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-email-account"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="username"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Username</FormLabel>
									<FormControl>
										<div className="flex items-center gap-2">
											<Input
												placeholder="john"
												{...field}
												onChange={(e) =>
													field.onChange(e.target.value.toLowerCase())
												}
											/>
											<span className="text-sm text-muted-foreground">@{domain}</span>
										</div>
									</FormControl>
									<FormDescription>
										Email address will be {field.value || "username"}@{domain}
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="fullName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Full Name (Optional)</FormLabel>
									<FormControl>
										<Input placeholder="John Doe" {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="password"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Password</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="••••••••"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										Minimum 8 characters
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="confirmPassword"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Confirm Password</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="••••••••"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="quota"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Storage Quota (MB)</FormLabel>
									<FormControl>
										<Input
											type="number"
											placeholder="5120"
											{...field}
											onChange={(e) =>
												field.onChange(
													e.target.value ? parseInt(e.target.value) : undefined,
												)
											}
										/>
									</FormControl>
									<FormDescription>
										Leave empty for unlimited storage. 1024 MB = 1 GB
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="enabled"
							render={({ field }) => (
								<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
									<div className="space-y-0.5">
										<FormLabel>Enable Account</FormLabel>
										<FormDescription>
											Account will be active and able to send/receive emails
										</FormDescription>
									</div>
									<FormControl>
										<Switch
											checked={field.value}
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>
					</form>

					<DialogFooter>
						<Button
							isLoading={form.formState.isSubmitting}
							form="hook-form-add-email-account"
							type="submit"
						>
							Create Account
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
