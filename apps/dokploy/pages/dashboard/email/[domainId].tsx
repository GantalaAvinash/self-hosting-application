import { ShowEmailDomainDetails } from "@/components/dashboard/email/show-email-domain-details";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import { appRouter } from "@/server/api/root";
import { validateRequest } from "@dokploy/server/lib/auth";
import { createServerSideHelpers } from "@trpc/react-query/server";
import type { GetServerSidePropsContext } from "next";
import type { ReactElement } from "react";
import superjson from "superjson";

const EmailDomainDetails = () => {
	return <ShowEmailDomainDetails />;
};

export default EmailDomainDetails;

EmailDomainDetails.getLayout = (page: ReactElement) => {
	return <DashboardLayout>{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext<{ domainId: string }>,
) {
	try {
	const { req, res, params } = ctx;
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

	await helpers.user.get.prefetch();

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

	if (params?.domainId) {
		try {
			await helpers.email.getDomain.prefetch({ emailDomainId: params.domainId });
		} catch (error) {
				console.error("Error prefetching email domain:", error);
			return {
				notFound: true,
			};
		}
	}
	
	return {
		props: {
			trpcState: helpers.dehydrate(),
			domainId: params?.domainId || "",
		},
	};
	} catch (error) {
		console.error("Error in getServerSideProps for email domain page:", error);
		return {
			notFound: true,
		};
	}
}
