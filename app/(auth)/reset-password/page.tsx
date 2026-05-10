"use client";

import { useState } from "react";
import { updatePassword } from "@/app/actions/auth";

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

export default function ResetPasswordPage() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(formData: FormData) {
		const password = formData.get("password") as string;
		const confirm = formData.get("confirm") as string;
		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}
		setLoading(true);
		setError(null);
		const result = await updatePassword(formData);
		if (result?.error) {
			setError(result.error);
			setLoading(false);
		}
		// On success, updatePassword redirects to /dashboard
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
					New password
				</h1>
				<p
					style={{
						fontFamily: "var(--font-karla)",
						fontSize: "13px",
						fontWeight: 300,
						color: "#5a5648",
					}}
				>
					Choose a strong password for your account.
				</p>
			</div>

			<form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
				<div>
					<label htmlFor="password" style={labelStyle}>
						New password
					</label>
					<input
						id="password"
						name="password"
						type="password"
						placeholder="8+ characters"
						minLength={8}
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
					<label htmlFor="confirm" style={labelStyle}>
						Confirm password
					</label>
					<input
						id="confirm"
						name="confirm"
						type="password"
						placeholder="Repeat password"
						minLength={8}
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
					{loading ? "Saving…" : "Set new password"}
				</button>
			</form>
		</div>
	);
}
