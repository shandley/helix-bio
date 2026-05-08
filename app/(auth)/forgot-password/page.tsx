"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/actions/auth";

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

export default function ForgotPasswordPage() {
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(formData: FormData) {
		setLoading(true);
		setError(null);
		const result = await requestPasswordReset(formData);
		if (result?.error) {
			setError(result.error);
			setLoading(false);
			return;
		}
		setSent(true);
		setLoading(false);
	}

	if (sent) {
		return (
			<div style={{
				width: "100%",
				maxWidth: "380px",
				background: "#faf7f2",
				border: "1px solid #ddd8ce",
				borderRadius: "4px",
				padding: "40px 36px",
			}}>
				<div style={{ marginBottom: "24px", paddingBottom: "20px", borderBottom: "1px solid #ddd8ce" }}>
					<h1 style={{
						fontFamily: "var(--font-playfair)",
						fontSize: "26px",
						fontWeight: 400,
						color: "#1c1a16",
						letterSpacing: "-0.01em",
						marginBottom: "6px",
					}}>
						Check your email
					</h1>
					<p style={{ fontFamily: "var(--font-karla)", fontSize: "13px", fontWeight: 300, color: "#5a5648" }}>
						If that address is registered, a reset link is on its way.
					</p>
				</div>
				<p style={{
					fontFamily: "var(--font-karla)",
					fontSize: "13px",
					lineHeight: 1.65,
					color: "#5a5648",
					fontWeight: 300,
					marginBottom: "24px",
				}}>
					Click the link in the email to set a new password. Check your spam folder if you don&apos;t see it within a minute.
				</p>
				<Link
					href="/login"
					style={{
						display: "block",
						width: "100%",
						padding: "12px",
						background: "#1a4731",
						color: "white",
						fontFamily: "var(--font-karla)",
						fontSize: "14px",
						fontWeight: 500,
						textAlign: "center",
						textDecoration: "none",
						borderRadius: "4px",
						letterSpacing: "0.02em",
					}}
				>
					Back to sign in
				</Link>
			</div>
		);
	}

	return (
		<div style={{
			width: "100%",
			maxWidth: "380px",
			background: "#faf7f2",
			border: "1px solid #ddd8ce",
			borderRadius: "4px",
			padding: "40px 36px",
		}}>
			<div style={{ marginBottom: "32px", paddingBottom: "20px", borderBottom: "1px solid #ddd8ce" }}>
				<h1 style={{
					fontFamily: "var(--font-playfair)",
					fontSize: "26px",
					fontWeight: 400,
					color: "#1c1a16",
					letterSpacing: "-0.01em",
					marginBottom: "6px",
				}}>
					Reset password
				</h1>
				<p style={{ fontFamily: "var(--font-karla)", fontSize: "13px", fontWeight: 300, color: "#5a5648" }}>
					Enter your email and we&apos;ll send a reset link.
				</p>
			</div>

			<form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
				<div>
					<label htmlFor="email" style={labelStyle}>Email</label>
					<input
						id="email"
						name="email"
						type="email"
						placeholder="you@lab.edu"
						required
						style={inputStyle}
						onFocus={e => { e.target.style.borderColor = "#1a4731"; }}
						onBlur={e => { e.target.style.borderColor = "#ddd8ce"; }}
					/>
				</div>

				{error && (
					<p style={{
						fontFamily: "var(--font-karla)",
						fontSize: "13px",
						color: "#8b3a2a",
						padding: "10px 14px",
						background: "rgba(139,58,42,0.06)",
						border: "1px solid rgba(139,58,42,0.2)",
						borderRadius: "4px",
					}}>
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
					{loading ? "Sending…" : "Send reset link"}
				</button>
			</form>

			<p style={{
				marginTop: "24px",
				textAlign: "center",
				fontFamily: "var(--font-karla)",
				fontSize: "13px",
				color: "#5a5648",
			}}>
				<Link href="/login" style={{ color: "#1a4731", textDecoration: "none", borderBottom: "1px solid #1a4731" }}>
					Back to sign in
				</Link>
			</p>
		</div>
	);
}
