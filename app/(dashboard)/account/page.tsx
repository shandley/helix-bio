"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { changeEmail, changePassword, signOutAllDevices, deleteAccount } from "@/app/actions/auth";

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

function Section({
	label,
	tone = "normal",
	children,
}: {
	label: string;
	tone?: "normal" | "danger";
	children: React.ReactNode;
}) {
	const danger = tone === "danger";
	return (
		<div
			style={{
				marginBottom: "24px",
				border: `1px solid ${danger ? "rgba(139,58,42,0.25)" : "#ddd8ce"}`,
				borderRadius: "4px",
				overflow: "hidden",
			}}
		>
			<div
				style={{
					padding: "12px 20px",
					background: danger ? "rgba(139,58,42,0.04)" : "#faf7f2",
					borderBottom: `1px solid ${danger ? "rgba(139,58,42,0.15)" : "#ddd8ce"}`,
				}}
			>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						letterSpacing: "0.12em",
						textTransform: "uppercase",
						color: danger ? "#8b3a2a" : "#5a5648",
					}}
				>
					{label}
				</span>
			</div>
			<div style={{ padding: "20px" }}>{children}</div>
		</div>
	);
}

function Feedback({ message, isError }: { message: string; isError?: boolean }) {
	return (
		<p
			style={{
				fontFamily: "var(--font-karla)",
				fontSize: "13px",
				color: isError ? "#8b3a2a" : "#1a4731",
				padding: "10px 14px",
				background: isError ? "rgba(139,58,42,0.06)" : "rgba(26,71,49,0.06)",
				border: `1px solid ${isError ? "rgba(139,58,42,0.2)" : "rgba(26,71,49,0.2)"}`,
				borderRadius: "4px",
				marginTop: "12px",
			}}
		>
			{message}
		</p>
	);
}

function submitBtn(loading: boolean, label: string, loadingLabel: string): React.CSSProperties {
	return {
		padding: "9px 20px",
		background: loading ? "#2d7a54" : "#1a4731",
		color: "white",
		fontFamily: "var(--font-karla)",
		fontSize: "13px",
		fontWeight: 500,
		border: "none",
		borderRadius: "4px",
		cursor: loading ? "not-allowed" : "pointer",
		opacity: loading ? 0.75 : 1,
		transition: "opacity 0.15s",
	};
}

function EmailSection({ currentEmail }: { currentEmail: string }) {
	const [loading, setLoading] = useState(false);
	const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

	async function handleSubmit(formData: FormData) {
		setLoading(true);
		setFeedback(null);
		const result = await changeEmail(formData);
		if ("error" in result) {
			setFeedback({ message: result.error, isError: true });
		} else {
			setFeedback({
				message: "We sent a confirmation link. Check your inbox to complete the change.",
				isError: false,
			});
		}
		setLoading(false);
	}

	return (
		<Section label="Email address">
			<p
				style={{
					fontFamily: "var(--font-karla)",
					fontSize: "13px",
					color: "#9a9284",
					marginBottom: "16px",
				}}
			>
				Current: <span style={{ color: "#1c1a16" }}>{currentEmail}</span>
			</p>
			<form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
				<div>
					<label htmlFor="email-new" style={labelStyle}>
						New email address
					</label>
					<input
						id="email-new"
						name="email"
						type="email"
						placeholder="new@lab.edu"
						required
						style={inputStyle}
						onFocus={(e) => { e.target.style.borderColor = "#1a4731"; }}
						onBlur={(e) => { e.target.style.borderColor = "#ddd8ce"; }}
					/>
				</div>
				{feedback && <Feedback message={feedback.message} isError={feedback.isError} />}
				<div>
					<button type="submit" disabled={loading} style={submitBtn(loading, "Update email", "Updating…")}>
						{loading ? "Updating…" : "Update email"}
					</button>
				</div>
			</form>
		</Section>
	);
}

function PasswordSection() {
	const [loading, setLoading] = useState(false);
	const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

	async function handleSubmit(formData: FormData) {
		const newPassword = formData.get("password") as string;
		const confirm = formData.get("confirm") as string;
		if (newPassword !== confirm) {
			setFeedback({ message: "New passwords do not match.", isError: true });
			return;
		}
		setLoading(true);
		setFeedback(null);
		const result = await changePassword(formData);
		if ("error" in result) {
			setFeedback({ message: result.error, isError: true });
		} else {
			setFeedback({ message: "Password updated.", isError: false });
		}
		setLoading(false);
	}

	return (
		<Section label="Password">
			<form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
				<div>
					<label htmlFor="current-password" style={labelStyle}>
						Current password
					</label>
					<input
						id="current-password"
						name="currentPassword"
						type="password"
						required
						style={inputStyle}
						onFocus={(e) => { e.target.style.borderColor = "#1a4731"; }}
						onBlur={(e) => { e.target.style.borderColor = "#ddd8ce"; }}
					/>
				</div>
				<div>
					<label htmlFor="new-password" style={labelStyle}>
						New password
					</label>
					<input
						id="new-password"
						name="password"
						type="password"
						placeholder="8+ characters"
						minLength={8}
						required
						style={inputStyle}
						onFocus={(e) => { e.target.style.borderColor = "#1a4731"; }}
						onBlur={(e) => { e.target.style.borderColor = "#ddd8ce"; }}
					/>
				</div>
				<div>
					<label htmlFor="confirm-password" style={labelStyle}>
						Confirm new password
					</label>
					<input
						id="confirm-password"
						name="confirm"
						type="password"
						placeholder="Repeat new password"
						minLength={8}
						required
						style={inputStyle}
						onFocus={(e) => { e.target.style.borderColor = "#1a4731"; }}
						onBlur={(e) => { e.target.style.borderColor = "#ddd8ce"; }}
					/>
				</div>
				{feedback && <Feedback message={feedback.message} isError={feedback.isError} />}
				<div>
					<button type="submit" disabled={loading} style={submitBtn(loading, "Change password", "Updating…")}>
						{loading ? "Updating…" : "Change password"}
					</button>
				</div>
			</form>
		</Section>
	);
}

function SessionsSection() {
	const [loading, setLoading] = useState(false);
	const [feedback, setFeedback] = useState<{ message: string; isError: boolean } | null>(null);

	async function handleSignOut() {
		setLoading(true);
		setFeedback(null);
		const result = await signOutAllDevices();
		if ("error" in result) {
			setFeedback({ message: result.error, isError: true });
		} else {
			setFeedback({ message: "All other sessions ended. You're still signed in here.", isError: false });
		}
		setLoading(false);
	}

	return (
		<Section label="Sessions">
			<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
				<p
					style={{
						fontFamily: "var(--font-karla)",
						fontSize: "13px",
						fontWeight: 300,
						color: "#5a5648",
						lineHeight: 1.6,
						maxWidth: "340px",
					}}
				>
					Sign out of all other devices and browsers. You'll remain signed in here.
				</p>
				<button
					type="button"
					onClick={handleSignOut}
					disabled={loading}
					style={{
						flexShrink: 0,
						padding: "8px 16px",
						fontFamily: "var(--font-karla)",
						fontSize: "13px",
						color: "#1c1a16",
						background: "none",
						border: "1px solid #ddd8ce",
						borderRadius: "4px",
						cursor: loading ? "not-allowed" : "pointer",
						opacity: loading ? 0.6 : 1,
						whiteSpace: "nowrap",
						transition: "border-color 0.15s",
					}}
					onMouseEnter={(e) => { if (!loading) (e.currentTarget as HTMLButtonElement).style.borderColor = "#9a9284"; }}
					onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#ddd8ce"; }}
				>
					{loading ? "Signing out…" : "Sign out all other devices"}
				</button>
			</div>
			{feedback && <Feedback message={feedback.message} isError={feedback.isError} />}
		</Section>
	);
}

function DangerZone() {
	const [confirming, setConfirming] = useState(false);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleDelete() {
		setRunning(true);
		setError(null);
		const result = await deleteAccount();
		if (result?.error) {
			setError(result.error);
			setRunning(false);
			setConfirming(false);
		}
	}

	return (
		<Section label="Danger zone" tone="danger">
			<div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
				<div>
					<p style={{ fontFamily: "var(--font-karla)", fontSize: "14px", fontWeight: 500, color: "#1c1a16", marginBottom: "4px" }}>
						Delete this account
					</p>
					<p style={{ fontFamily: "var(--font-karla)", fontSize: "13px", fontWeight: 300, color: "#5a5648", lineHeight: 1.6, maxWidth: "340px" }}>
						Permanently removes your account, all uploaded sequences, and all associated storage files. This cannot be undone.
					</p>
				</div>
				{!confirming && (
					<button
						type="button"
						onClick={() => setConfirming(true)}
						style={{
							flexShrink: 0,
							padding: "8px 16px",
							fontFamily: "var(--font-karla)",
							fontSize: "13px",
							color: "#8b3a2a",
							background: "none",
							border: "1px solid rgba(139,58,42,0.4)",
							borderRadius: "4px",
							cursor: "pointer",
							whiteSpace: "nowrap",
							transition: "background 0.15s, border-color 0.15s",
						}}
						onMouseEnter={(e) => {
							(e.currentTarget as HTMLButtonElement).style.background = "rgba(139,58,42,0.06)";
							(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(139,58,42,0.7)";
						}}
						onMouseLeave={(e) => {
							(e.currentTarget as HTMLButtonElement).style.background = "none";
							(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(139,58,42,0.4)";
						}}
					>
						Delete account
					</button>
				)}
			</div>

			{confirming && (
				<div style={{ marginTop: "20px", padding: "16px", background: "rgba(139,58,42,0.05)", border: "1px solid rgba(139,58,42,0.2)", borderRadius: "3px" }}>
					<p style={{ fontFamily: "var(--font-karla)", fontSize: "13px", color: "#8b3a2a", marginBottom: "16px", lineHeight: 1.6 }}>
						Are you sure? This will permanently delete your account and all your sequences. There is no recovery.
					</p>
					{error && (
						<p style={{ fontFamily: "var(--font-karla)", fontSize: "12px", color: "#8b3a2a", background: "rgba(139,58,42,0.08)", border: "1px solid rgba(139,58,42,0.2)", borderRadius: "3px", padding: "8px 12px", marginBottom: "12px" }}>
							{error}
						</p>
					)}
					<div style={{ display: "flex", gap: "10px" }}>
						<button
							type="button"
							onClick={handleDelete}
							disabled={running}
							style={{ padding: "9px 20px", fontFamily: "var(--font-karla)", fontSize: "13px", fontWeight: 500, color: "white", background: running ? "#c45a3a" : "#8b3a2a", border: "none", borderRadius: "4px", cursor: running ? "not-allowed" : "pointer", opacity: running ? 0.75 : 1, transition: "opacity 0.15s" }}
						>
							{running ? "Deleting…" : "Yes, permanently delete"}
						</button>
						<button
							type="button"
							onClick={() => { setConfirming(false); setError(null); }}
							disabled={running}
							style={{ padding: "9px 20px", fontFamily: "var(--font-karla)", fontSize: "13px", color: "#5a5648", background: "none", border: "1px solid #ddd8ce", borderRadius: "4px", cursor: "pointer" }}
						>
							Cancel
						</button>
					</div>
				</div>
			)}
		</Section>
	);
}

export default function AccountPage() {
	const [user, setUser] = useState<User | null>(null);

	useEffect(() => {
		const supabase = createClient();
		supabase.auth.getUser().then(({ data }) => setUser(data.user));
	}, []);

	const providers = ((user?.app_metadata?.providers ?? [user?.app_metadata?.provider]) as string[]).filter(Boolean);
	const hasEmailProvider = providers.includes("email");

	return (
		<div style={{ maxWidth: "560px", margin: "0 auto", padding: "48px 40px 80px" }}>
			<h1
				style={{
					fontFamily: "var(--font-playfair)",
					fontSize: "28px",
					fontWeight: 400,
					color: "#1c1a16",
					letterSpacing: "-0.01em",
					marginBottom: "6px",
				}}
			>
				Account
			</h1>
			<p style={{ fontFamily: "var(--font-karla)", fontSize: "13px", color: "#9a9284", marginBottom: "40px" }}>
				Manage your Ori account settings.
			</p>

			{user && <EmailSection currentEmail={user.email ?? ""} />}
			{user && hasEmailProvider && <PasswordSection />}
			<SessionsSection />
			<DangerZone />
		</div>
	);
}
