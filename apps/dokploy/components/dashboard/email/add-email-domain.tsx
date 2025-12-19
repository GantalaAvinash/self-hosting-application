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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/utils/api";
import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const AddEmailDomainSchema = z.object({
	domain: z
		.string()
		.min(1, "Domain is required")
		.regex(
			/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/,
			"Invalid domain format (e.g., example.com)",
		),
	description: z.string().optional(),
	projectId: z.string().optional(),
	serverId: z.string().optional(),
	webmailUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
	mailServerIp: z.string().ip("Must be a valid IP address").optional().or(z.literal("")),
});

type AddEmailDomain = z.infer<typeof AddEmailDomainSchema>;

export const AddEmailDomain = () => {
	const utils = api.useUtils();
	const [isOpen, setIsOpen] = useState(false);

	const { data: projects } = api.project.all.useQuery();
	const { mutateAsync, error, isError } = api.email.createDomain.useMutation();

	const form = useForm<AddEmailDomain>({
		defaultValues: {
			domain: "",
			description: "",
			projectId: "",
			serverId: "",
			webmailUrl: "",
			mailServerIp: "",
		},
		resolver: zodResolver(AddEmailDomainSchema),
	});

	const onSubmit = async (data: AddEmailDomain) => {
		await mutateAsync({
			domain: data.domain.toLowerCase().trim(),
			description: data.description,
			projectId: data.projectId || undefined,
			serverId: data.serverId || undefined,
			webmailUrl: data.webmailUrl || undefined,
			mailServerIp: data.mailServerIp || undefined,
		})
			.then(async () => {
				await utils.email.getAllDomains.invalidate();
				toast.success("Email domain created successfully");
				setIsOpen(false);
				form.reset();
			})
			.catch(() => {
				toast.error("Error creating email domain");
			});
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button>
					<PlusIcon className="h-4 w-4" />
					Add Domain
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Add Email Domain</DialogTitle>
					<DialogDescription>
						Configure a new domain for email hosting. You'll need to update DNS
						records after creation.
					</DialogDescription>
				</DialogHeader>
				{isError && <AlertBlock type="error">{error?.message}</AlertBlock>}
				<Form {...form}>
					<form
						id="hook-form-add-email-domain"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid w-full gap-4"
					>
						<FormField
							control={form.control}
							name="domain"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Domain</FormLabel>
									<FormControl>
										<Input
											placeholder="example.com"
											{...field}
											onChange={(e) =>
												field.onChange(e.target.value.toLowerCase())
											}
										/>
									</FormControl>
									<FormDescription>
										The domain name for your email service (without
										subdomain)
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="description"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Description (Optional)</FormLabel>
									<FormControl>
										<Textarea
											placeholder="Company email domain..."
											className="resize-none"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

<FormField
						control={form.control}
						name="webmailUrl"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Webmail URL (Optional)</FormLabel>
									<FormControl>
										<Input
											placeholder="https://webmail.example.com"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										URL where users can access webmail (e.g., Roundcube subdomain)
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="mailServerIp"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Mail Server IP (Optional)</FormLabel>
									<FormControl>
										<Input
											placeholder="123.456.789.0"
											{...field}
										/>
									</FormControl>
									<FormDescription>
										IP address of your mail server for DNS records
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}

							name="projectId"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Project (Optional)</FormLabel>
									<Select
										onValueChange={field.onChange}
										defaultValue={field.value}
									>
										<FormControl>
											<SelectTrigger>
												<SelectValue placeholder="Select a project" />
											</SelectTrigger>
										</FormControl>
										<SelectContent>
											{projects?.map((project) => (
												<SelectItem
													key={project.projectId}
													value={project.projectId}
												>
													{project.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<FormDescription>
										Associate this domain with a project
									</FormDescription>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>

					<DialogFooter>
						<Button
							isLoading={form.formState.isSubmitting}
							form="hook-form-add-email-domain"
							type="submit"
						>
							Create Domain
						</Button>
					</DialogFooter>
				</Form>
			</DialogContent>
		</Dialog>
	);
};
