import type { NextConfig } from "next";

const securityHeaders = [
	// Prevent clickjacking
	{ key: "X-Frame-Options", value: "DENY" },
	// Prevent MIME sniffing
	{ key: "X-Content-Type-Options", value: "nosniff" },
	// Referrer — full URL on same-origin, origin only on cross-origin
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	// Disable sensors the app doesn't use
	{ key: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
	// Enforce HTTPS for 1 year, include subdomains
	{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
	// CSP: allow Supabase storage + auth, Anthropic API, Google Fonts
	{
		key: "Content-Security-Policy",
		value: [
			"default-src 'self'",
			"script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed by SeqViz/WASM
			"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
			"font-src 'self' data: https://fonts.gstatic.com",
			"img-src 'self' data: blob: https:",
			"connect-src 'self' https://*.supabase.co https://api.anthropic.com",
			"frame-ancestors 'none'",
		].join("; "),
	},
];

const nextConfig: NextConfig = {
	reactStrictMode: false,
	transpilePackages: ["@shandley/primd"],
	turbopack: {},

	async headers() {
		return [
			{
				source: "/(.*)",
				headers: securityHeaders,
			},
		];
	},

	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "*.supabase.co",
				pathname: "/storage/v1/object/**",
			},
		],
		formats: ["image/avif", "image/webp"],
		qualities: [75, 85],
	},
};

export default nextConfig;
