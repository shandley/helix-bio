"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { login } from "@/app/actions/auth";

const URL_ERROR_MESSAGES: Record<string, string> = {
	confirmation_failed:
		"That confirmation link is invalid or has expired. Please sign up again to get a new one.",
	otp_expired: "That confirmation link has expired. Please sign up again to get a new one.",
	access_denied: "That confirmation link is no longer valid. Please sign up again.",
};

const inputStyle: React.CSSProperties = {
	width: "100%",
	padding: "10px 14px",
	fontFamily: "var(--font-karla)",
	fontSize: "14px",
	color: "#1c1a16",
	background: "#faf7f2",
	border: "1px solid #ddd8ce",
	borderRadius: "4px",
	outline: "none",
	transition: "border-color 0.15s",
};

const labelStyle: React.CSSProperties = {
	display: "block",
	fontFamily: "var(--font-courier)",
	fontSize: "9px",
	letterSpacing: "0.12em",
	textTransform: "uppercase",
	color: "#5a5648",
	marginBottom: "6px",
};

function LoginForm() {
	const searchParams = useSearchParams();
	const urlError = searchParams.get("error_code") ?? searchParams.get("error") ?? null;
	const urlErrorMessage = urlError
		? (URL_ERROR_MESSAGES[urlError] ?? "Something went wrong. Please try again.")
		: null;

	const [error, setError] = useState<string | null>(urlErrorMessage);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(formData: FormData) {
		setLoading(true);
		setError(null);
		const result = await login(formData);
		if (result?.error) {
			setError(result.error);
			setLoading(false);
		}
	}

	return (
		<div
			style={{
				width: "100%",
				maxWidth: "380px",
				background: "#faf7f2",
				border: "1px solid #ddd8ce",
				borderRadius: "4px",
				padding: "40px 36px",
			}}
		>
			{/* Header */}
			<div
				style={{ marginBottom: "32px", paddingBottom: "20px", borderBottom: "1px solid #ddd8ce" }}
			>
				<h1
					style={{
						fontFamily: "var(--font-playfair)",
						fontSize: "26px",
						fontWeight: 400,
						color: "#1c1a16",
						letterSpacing: "-0.01em",
						marginBottom: "6px",
					}}
				>
					Sign in
				</h1>
				<p
					style={{
						fontFamily: "var(--font-karla)",
						fontSize: "13px",
						fontWeight: 300,
						color: "#5a5648",
					}}
				>
					Enter your email and password to continue.
				</p>
			</div>

			<form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
				<div>
					<label htmlFor="email" style={labelStyle}>
						Email
					</label>
					<input
						id="email"
						name="email"
						type="email"
						placeholder="you@lab.edu"
						required
						style={inputStyle}
						onFocus={(e) => {
							e.target.style.borderColor = "#1a4731";
						}}
						onBlur={(e) => {
							e.target.style.borderColor = "#ddd8ce";
						}}
					/>
				</div>
				<div>
					<label htmlFor="password" style={labelStyle}>
						Password
					</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						style={inputStyle}
						onFocus={(e) => {
							e.target.style.borderColor = "#1a4731";
						}}
						onBlur={(e) => {
							e.target.style.borderColor = "#ddd8ce";
						}}
					/>
				</div>

				{error && (
					<p
						style={{
							fontFamily: "var(--font-karla)",
							fontSize: "13px",
							color: "#8b3a2a",
							padding: "10px 14px",
							background: "rgba(139,58,42,0.06)",
							border: "1px solid rgba(139,58,42,0.2)",
							borderRadius: "4px",
						}}
					>
						{error}
					</p>
				)}

				<button
					type="submit"
					disabled={loading}
					style={{
						width: "100%",
						padding: "12px",
						background: loading ? "#2d7a54" : "#1a4731",
						color: "white",
						fontFamily: "var(--font-karla)",
						fontSize: "14px",
						fontWeight: 500,
						border: "none",
						borderRadius: "4px",
						cursor: loading ? "not-allowed" : "pointer",
						letterSpacing: "0.02em",
						transition: "opacity 0.15s",
						opacity: loading ? 0.75 : 1,
					}}
				>
					{loading ? "Signing in…" : "Sign in"}
				</button>
			</form>

			<div
				style={{
					marginTop: "24px",
					display: "flex",
					justifyContent: "space-between",
					fontFamily: "var(--font-karla)",
					fontSize: "13px",
					color: "#5a5648",
				}}
			>
				<Link
					href="/forgot-password"
					style={{ color: "#9a9284", textDecoration: "none", borderBottom: "1px solid #ddd8ce" }}
				>
					Forgot password?
				</Link>
				<span>
					No account?{" "}
					<Link
						href="/signup"
						style={{ color: "#1a4731", textDecoration: "none", borderBottom: "1px solid #1a4731" }}
					>
						Sign up
					</Link>
				</span>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense>
			<LoginForm />
		</Suspense>
	);
}
