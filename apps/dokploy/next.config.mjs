/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */

/** @type {import("next").NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	typescript: {
		ignoreBuildErrors: true,
	},
	transpilePackages: ["@dokploy/server"],
	webpack: (config, { isServer }) => {
		if (isServer) {
			// Ensure @dokploy/server is resolved correctly during build
			config.resolve.alias = {
				...config.resolve.alias,
				"@dokploy/server": require("path").resolve(__dirname, "../../packages/server"),
			};
		}
		return config;
	},
	/**
	 * If you are using `appDir` then you must comment the below `i18n` config out.
	 *
	 * @see https://github.com/vercel/next.js/issues/41980
	 */
	i18n: {
		locales: ["en"],
		defaultLocale: "en",
	},
};

export default nextConfig;
