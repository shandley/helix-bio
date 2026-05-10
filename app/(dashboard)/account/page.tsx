"use client";

import { useState } from "react";
import { deleteAccount } from "@/app/actions/auth";

export default function AccountPage() {
	const [confirming, setConfirming] = useState(false);
	const [running, setRunning] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleDelete() {
		setRunning(true);
		setError(null);
		const result = await deleteAccount();
		// deleteAccount redirects on success — result only returned on error
		if (result?.error) {
			setError(result.error);
			setRunning(false);
			setConfirming(false);
		}
	}

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
			<p
				style={{
					fontFamily: "var(--font-karla)",
					fontSize: "13px",
					color: "#9a9284",
					marginBottom: "48px",
				}}
			>
				Manage your Ori account settings.
			</p>

			{/* Danger zone */}
			<div
				style={{
					border: "1px solid rgba(139,58,42,0.25)",
					borderRadius: "4px",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						padding: "12px 20px",
						background: "rgba(139,58,42,0.04)",
						borderBottom: "1px solid rgba(139,58,42,0.15)",
					}}
				>
					<span
						style={{
							fontFamily: "var(--font-courier)",
							fontSize: "9px",
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							color: "#8b3a2a",
						}}
					>
						Danger zone
					</span>
				</div>

				<div style={{ padding: "20px" }}>
					<div
						style={{
							display: "flex",
							alignItems: "flex-start",
							justifyContent: "space-between",
							gap: "24px",
						}}
					>
						<div>
							<p
								style={{
									fontFamily: "var(--font-karla)",
									fontSize: "14px",
									fontWeight: 500,
									color: "#1c1a16",
									marginBottom: "4px",
								}}
							>
								Delete this account
							</p>
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
								Permanently removes your account, all uploaded sequences, and all associated
								storage files. This cannot be undone.
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
									(e.currentTarget as HTMLButtonElement).style.background =
										"rgba(139,58,42,0.06)";
									(e.currentTarget as HTMLButtonElement).style.borderColor =
										"rgba(139,58,42,0.7)";
								}}
								onMouseLeave={(e) => {
									(e.currentTarget as HTMLButtonElement).style.background = "none";
									(e.currentTarget as HTMLButtonElement).style.borderColor =
										"rgba(139,58,42,0.4)";
								}}
							>
								Delete account
							</button>
						)}
					</div>

					{confirming && (
						<div
							style={{
								marginTop: "20px",
								padding: "16px",
								background: "rgba(139,58,42,0.05)",
								border: "1px solid rgba(139,58,42,0.2)",
								borderRadius: "3px",
							}}
						>
							<p
								style={{
									fontFamily: "var(--font-karla)",
									fontSize: "13px",
									color: "#8b3a2a",
									marginBottom: "16px",
									lineHeight: 1.6,
								}}
							>
								Are you sure? This will permanently delete your account and all your sequences.
								There is no recovery.
							</p>
							{error && (
								<p
									style={{
										fontFamily: "var(--font-karla)",
										fontSize: "12px",
										color: "#8b3a2a",
										background: "rgba(139,58,42,0.08)",
										border: "1px solid rgba(139,58,42,0.2)",
										borderRadius: "3px",
										padding: "8px 12px",
										marginBottom: "12px",
									}}
								>
									{error}
								</p>
							)}
							<div style={{ display: "flex", gap: "10px" }}>
								<button
									type="button"
									onClick={handleDelete}
									disabled={running}
									style={{
										padding: "9px 20px",
										fontFamily: "var(--font-karla)",
										fontSize: "13px",
										fontWeight: 500,
										color: "white",
										background: running ? "#c45a3a" : "#8b3a2a",
										border: "none",
										borderRadius: "4px",
										cursor: running ? "not-allowed" : "pointer",
										opacity: running ? 0.75 : 1,
										transition: "opacity 0.15s",
									}}
								>
									{running ? "Deleting…" : "Yes, permanently delete"}
								</button>
								<button
									type="button"
									onClick={() => { setConfirming(false); setError(null); }}
									disabled={running}
									style={{
										padding: "9px 20px",
										fontFamily: "var(--font-karla)",
										fontSize: "13px",
										color: "#5a5648",
										background: "none",
										border: "1px solid #ddd8ce",
										borderRadius: "4px",
										cursor: "pointer",
									}}
								>
									Cancel
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
