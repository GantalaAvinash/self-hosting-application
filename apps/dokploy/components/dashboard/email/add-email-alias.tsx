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
import { api } from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const AddEmailAliasSchema = z.object({
	aliasAddress: z
		.string()
		.min(1, "Alias address is required")
		.regex(
			/^[a-z0-9._-]+$/,
			"Address can only contain lowercase letters, numbers, dots, hyphens, and underscores",
		),
	destinationAddress: z
		.string()
		.min(1, "Destination address is required")
		.regex(
			/^[a-z0-9._-]+$/,
			"Address can only contain lowercase letters, numbers, dots, hyphens, and underscores",
		),
});

type AddEmailAlias = z.infer<typeof AddEmailAliasSchema>;

interface Props {
	domainId: string;
	domain: string;
}

export const AddEmailAlias = ({ domainId, domain }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { data: accounts } = api.email.getAccountsByDomain.useQuery({ emailDomainId: domainId });
	const { mutateAsync, error, isError } = api.email.createAlias.useMutation();

	const form = useForm<AddEmailAlias>({
		defaultValues: {
			aliasAddress: "",
			destinationAddress: "",
		},
		resolver: zodResolver(AddEmailAliasSchema),
	});

	const onSubmit = async (data: AddEmailAlias) => {
		await mutateAsync({
			emailDomainId: domainId,
			aliasAddress: data.aliasAddress.toLowerCase().trim(),
			destinationAddress: data.destinationAddress.toLowerCase().trim(),
		})
			.then(async () => {
				await utils.email.getAliasesByDomain.invalidate({ emailDomainId: domainId });
				toast.success("Email alias created successfully");
				setIsOpen(false);
				form.reset();
			})
			.catch(() => {
				toast.error("Error creating email alias");
			});
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon className="h-4 w-4" />
					Add Alias
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Email Alias</DialogTitle>
					<DialogDescription>
						Create an alternate email address for an existing account
					</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-email-alias"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="aliasAddress"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Alias Address</FormLabel>
									<FormControl>
										<div className="flex items-center gap-2">
											<Input
												placeholder="sales"
												{...field}
												onChange={(e) =>
													field.onChange(e.target.value.toLowerCase())
												}
											/>
											<span className="text-sm text-muted-foreground">@{domain}</span>
										</div>
									</FormControl>
									<FormDescription>
										The new alias email address
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="destinationAddress"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Destination Account</FormLabel>
									<FormControl>
										<div className="flex items-center gap-2">
											<Input
												placeholder="contact"
												{...field}
												onChange={(e) =>
													field.onChange(e.target.value.toLowerCase())
												}
											/>
											<span className="text-sm text-muted-foreground">@{domain}</span>
										</div>
									</FormControl>
									<FormDescription>
										The existing email account that will receive the emails
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						{accounts && accounts.length > 0 && (
							<div className="rounded-md bg-muted p-3">
								<p className="mb-2 text-sm font-medium">Available accounts:</p>
								<div className="flex flex-wrap gap-2">
									{accounts.map((account: any) => (
										<button
											key={account.emailAccountId}
											type="button"
											onClick={() =>
												form.setValue("destinationAddress", account.username)
											}
											className="rounded bg-background px-2 py-1 text-xs hover:bg-accent"
										>
											{account.username}@{domain}
										</button>
									))}
								</div>
							</div>
						)}
					</form>

					<DialogFooter>
						<Button
							isLoading={form.formState.isSubmitting}
							form="hook-form-add-email-alias"
							type="submit"
						>
							Create Alias
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
