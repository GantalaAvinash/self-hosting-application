import { ShowEmailDomains } from "@/components/dashboard/email/show-email-domains";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";
import { validateRequest } from "@dokploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import { type ReactElement } from "react";
import superjson from "superjson";

const EmailHosting = () => {
	return <ShowEmailDomains />;
};

export default EmailHosting;

EmailHosting.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
	try {
	const { req, res } = context;
	const { user, session } = await validateRequest(req);

	if (!user) {
		return {
			redirect: {
				permanent: true,
				destination: "/",
			},
		};
	}

	const helpers = createServerSideHelpers({
		router: appRouter,
		ctx: {
			req: req as any,
			res: res as any,
			db: null as any,
			session: session as any,
			user: user as any,
		},
		transformer: superjson,
	});

	if (user.role === "member") {
		try {
			const member = await helpers.user.get.fetch();
			if (!member?.canAccessToEmail) {
				return {
					redirect: {
						permanent: true,
						destination: "/dashboard/projects",
					},
				};
			}
		} catch (error) {
				console.error("Error checking member email access:", error);
			return {
				redirect: {
					permanent: true,
					destination: "/dashboard/projects",
				},
			};
		}
	}

	try {
		await helpers.email.getAllDomains.prefetch();
	} catch (error) {
			console.error("Error prefetching email domains:", error);
			// Email domains might not exist yet, continue anyway
	}

	return {
		props: {
			trpcState: helpers.dehydrate(),
		},
	};
	} catch (error) {
		console.error("Error in getServerSideProps for email page:", error);
		// Return empty props to prevent 400 error
		return {
			props: {
				trpcState: {
					json: {
						queries: [],
						mutations: [],
					},
				},
			},
		};
	}
}
