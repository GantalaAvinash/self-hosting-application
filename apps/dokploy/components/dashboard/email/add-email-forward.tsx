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

const AddEmailForwardSchema = z.object({
	sourceAddress: z
		.string()
		.min(1, "Source address is required")
		.regex(
			/^[a-z0-9._-]+$/,
			"Address can only contain lowercase letters, numbers, dots, hyphens, and underscores",
		),
	destinationAddress: z.string().email("Invalid email address"),
});

type AddEmailForward = z.infer<typeof AddEmailForwardSchema>;

interface Props {
	domainId: string;
	domain: string;
}

export const AddEmailForward = ({ domainId, domain }: Props) => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { mutateAsync, error, isError } = api.email.createForward.useMutation();

	const form = useForm<AddEmailForward>({
		defaultValues: {
			sourceAddress: "",
			destinationAddress: "",
		},
		resolver: zodResolver(AddEmailForwardSchema),
	});

	const onSubmit = async (data: AddEmailForward) => {
		await mutateAsync({
			emailDomainId: domainId,
			sourceAddress: data.sourceAddress.toLowerCase().trim(),
			destinationAddress: data.destinationAddress.toLowerCase().trim(),
		})
			.then(async () => {
				await utils.email.getForwardsByDomain.invalidate({ emailDomainId: domainId });
				toast.success("Email forward created successfully");
				setIsOpen(false);
				form.reset();
			})
			.catch(() => {
				toast.error("Error creating email forward");
			});
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon className="h-4 w-4" />
					Add Forward
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Email Forward</DialogTitle>
					<DialogDescription>
						Forward emails from one address to another
					</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-email-forward"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="sourceAddress"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Source Address</FormLabel>
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
										Emails sent to {field.value || "contact"}@{domain} will be forwarded
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
									<FormLabel>Destination Address</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="user@example.com"
											{...field}
											onChange={(e) =>
												field.onChange(e.target.value.toLowerCase())
											}
										/>
									</FormControl>
									<FormDescription>
										The email address where emails will be forwarded to
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>

					<DialogFooter>
						<Button
							isLoading={form.formState.isSubmitting}
							form="hook-form-add-email-forward"
							type="submit"
						>
							Create Forward
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
