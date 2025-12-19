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
	const { req, res, params } = ctx;
	const { user, session } = await validateRequest(req);

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

	if (!user) {
		return {
			redirect: {
				permanent: true,
				destination: "/",
			},
		};
	}

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
}
