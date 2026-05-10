"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, SequenceContext } from "@/app/api/chat/route";

interface AIPanelProps {
	context: SequenceContext;
}

const MAX_SEQ_LEN = 10_000;

function TypingDots() {
	return (
		<span style={{ display: "inline-flex", gap: "3px", alignItems: "center", padding: "2px 0" }}>
			{[0, 1, 2].map((i) => (
				<span
					key={i}
					style={{
						width: "4px",
						height: "4px",
						borderRadius: "50%",
						background: "#9a9284",
						display: "inline-block",
						animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
					}}
				/>
			))}
		</span>
	);
}

const inlineCodeStyle = {
	fontFamily: "var(--font-courier)",
	fontSize: "10px",
	background: "rgba(26,71,49,0.08)",
	padding: "1px 4px",
	borderRadius: "2px",
};

function renderInline(text: string): React.ReactNode[] {
	return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) => {
		if (part.startsWith("**") && part.endsWith("**"))
			return <strong key={j}>{part.slice(2, -2)}</strong>;
		if (part.startsWith("`") && part.endsWith("`"))
			return (
				<code key={j} style={inlineCodeStyle}>
					{part.slice(1, -1)}
				</code>
			);
		return part;
	});
}

function renderMarkdown(text: string): React.ReactNode[] {
	const nodes: React.ReactNode[] = [];
	const lines = text.split("\n");
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		// Fenced code block
		if (line.startsWith("```")) {
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i].startsWith("```")) {
				codeLines.push(lines[i]);
				i++;
			}
			nodes.push(
				<pre
					key={`cb-${i}`}
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "10px",
						background: "rgba(26,71,49,0.06)",
						border: "1px solid rgba(26,71,49,0.12)",
						borderRadius: "3px",
						padding: "8px 10px",
						overflowX: "auto",
						margin: "6px 0",
						whiteSpace: "pre-wrap",
						lineHeight: 1.6,
					}}
				>
					{codeLines.join("\n")}
				</pre>,
			);
			i++;
			continue;
		}

		// Headings
		if (line.startsWith("### ")) {
			nodes.push(
				<p
					key={i}
					style={{ fontWeight: 600, fontSize: "11px", color: "#1c1a16", margin: "8px 0 2px" }}
				>
					{renderInline(line.slice(4))}
				</p>,
			);
			i++;
			continue;
		}
		if (line.startsWith("## ")) {
			nodes.push(
				<p
					key={i}
					style={{ fontWeight: 700, fontSize: "12px", color: "#1c1a16", margin: "10px 0 2px" }}
				>
					{renderInline(line.slice(3))}
				</p>,
			);
			i++;
			continue;
		}
		if (line.startsWith("# ")) {
			nodes.push(
				<p
					key={i}
					style={{ fontWeight: 700, fontSize: "13px", color: "#1c1a16", margin: "10px 0 4px" }}
				>
					{renderInline(line.slice(2))}
				</p>,
			);
			i++;
			continue;
		}

		// Bullet list — collect consecutive bullet lines
		if (line.startsWith("- ") || line.startsWith("* ")) {
			const items: React.ReactNode[] = [];
			while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* "))) {
				items.push(
					<li key={i} style={{ marginBottom: "2px" }}>
						{renderInline(lines[i].slice(2))}
					</li>,
				);
				i++;
			}
			nodes.push(
				<ul key={`ul-${i}`} style={{ paddingLeft: "16px", margin: "4px 0" }}>
					{items}
				</ul>,
			);
			continue;
		}

		// Numbered list
		if (/^\d+\.\s/.test(line)) {
			const items: React.ReactNode[] = [];
			while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
				items.push(
					<li key={i} style={{ marginBottom: "2px" }}>
						{renderInline(lines[i].replace(/^\d+\.\s/, ""))}
					</li>,
				);
				i++;
			}
			nodes.push(
				<ol key={`ol-${i}`} style={{ paddingLeft: "16px", margin: "4px 0" }}>
					{items}
				</ol>,
			);
			continue;
		}

		// Empty line → spacer
		if (line === "") {
			nodes.push(<span key={i} style={{ display: "block", height: "6px" }} />);
			i++;
			continue;
		}

		// Regular text
		nodes.push(
			<span key={i} style={{ display: "block" }}>
				{renderInline(line)}
			</span>,
		);
		i++;
	}

	return nodes;
}

function MessageBubble({ msg, streaming }: { msg: ChatMessage; streaming?: boolean }) {
	const isUser = msg.role === "user";
	return (
		<div
			style={{
				padding: "10px 14px",
				borderBottom: "1px solid rgba(221,216,206,0.4)",
				background: isUser ? "rgba(26,71,49,0.04)" : "transparent",
			}}
		>
			<div
				style={{
					fontFamily: "var(--font-courier)",
					fontSize: "8px",
					letterSpacing: "0.12em",
					textTransform: "uppercase",
					color: isUser ? "#1a4731" : "#9a9284",
					marginBottom: "5px",
				}}
			>
				{isUser ? "You" : "Ori AI"}
			</div>
			<div
				style={{
					fontFamily: "var(--font-karla)",
					fontSize: "12px",
					color: "#1c1a16",
					lineHeight: 1.65,
				}}
			>
				{msg.content ? renderMarkdown(msg.content) : streaming ? <TypingDots /> : null}
			</div>
		</div>
	);
}

export function AIPanel({ context }: AIPanelProps) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [streaming, setStreaming] = useState(false);
	const [inputVal, setInputVal] = useState("");
	const [error, setError] = useState<string | null>(null);
	const bottomRef = useRef<HTMLDivElement>(null);
	const abortRef = useRef<AbortController | null>(null);
	const initialized = useRef(false);
	const mountedRef = useRef(false);
	// Always reflects the latest context without causing sendMessage to recreate
	const contextRef = useRef<SequenceContext>(context);
	contextRef.current = {
		...context,
		seq: context.seq && context.seq.length <= MAX_SEQ_LEN ? context.seq : null,
	};

	useEffect(() => {
		mountedRef.current = true;
		return () => {
			mountedRef.current = false;
		};
	}, []);

	const sendMessage = useCallback(async (userText: string, history: ChatMessage[]) => {
		const newHistory: ChatMessage[] = [...history, { role: "user", content: userText }];
		setMessages([...newHistory, { role: "assistant", content: "" }]);
		setStreaming(true);
		setError(null);

		abortRef.current = new AbortController();

		try {
			const res = await fetch("/api/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: newHistory, context: contextRef.current }),
				signal: abortRef.current.signal,
			});

			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `HTTP ${res.status}`);
			}

			if (!res.body) throw new Error("No response body");
			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let assistantContent = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				assistantContent += decoder.decode(value, { stream: true });
				const captured = assistantContent;
				if (mountedRef.current) {
					setMessages([...newHistory, { role: "assistant", content: captured }]);
				}
			}
		} catch (e) {
			if ((e as Error).name === "AbortError") return;
			const msg = (e as Error).message;
			if (mountedRef.current) {
				setError(
					msg.includes("401") || msg.includes("key")
						? "API key not configured — set ANTHROPIC_API_KEY in your Vercel environment."
						: "Something went wrong. Please try again.",
				);
				setMessages(newHistory);
			}
		} finally {
			if (mountedRef.current) setStreaming(false);
		}
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Opening analysis: triggered once on mount
	useEffect(() => {
		if (initialized.current) return;
		initialized.current = true;
		void sendMessage(
			"Briefly introduce this construct in 2–3 sentences: what it is, what it's used for, and one thing worth knowing about it. Be specific to this sequence.",
			[],
		);
	}, [sendMessage]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	function handleSend() {
		const text = inputVal.trim();
		if (!text || streaming) return;
		setInputVal("");
		// Exclude the opening probe (index 0 user msg) from visible history sent to API
		const history = messages.filter((_, i) => i > 0);
		void sendMessage(text, history);
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	// Show all messages except the silent opening probe (first user message)
	const visibleMessages = messages.slice(1);
	const lastMsg = messages[messages.length - 1];
	const showTyping = streaming && lastMsg?.role === "assistant" && !lastMsg.content;

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
			{/* Header */}
			<div
				style={{
					padding: "12px 16px 10px",
					borderBottom: "1px solid #ddd8ce",
					flexShrink: 0,
					display: "flex",
					alignItems: "baseline",
					justifyContent: "space-between",
				}}
			>
				<span
					style={{
						fontFamily: "var(--font-playfair)",
						fontSize: "15px",
						color: "#1c1a16",
						letterSpacing: "-0.01em",
					}}
				>
					Ask Ori
				</span>
				<span
					style={{
						fontFamily: "var(--font-courier)",
						fontSize: "8px",
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						color: "#9a9284",
					}}
				>
					Claude ·{" "}
					{context.seq && context.seq.length <= MAX_SEQ_LEN ? "seq included" : "seq truncated"}
				</span>
			</div>

			{/* Thread */}
			<div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
				{/* Initial loading state */}
				{messages.length === 0 && streaming && (
					<div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(221,216,206,0.4)" }}>
						<div
							style={{
								fontFamily: "var(--font-courier)",
								fontSize: "8px",
								letterSpacing: "0.12em",
								textTransform: "uppercase",
								color: "#9a9284",
								marginBottom: "5px",
							}}
						>
							Ori AI
						</div>
						<TypingDots />
					</div>
				)}

				{visibleMessages.map((m, i) => (
					<MessageBubble
						key={i}
						msg={m}
						streaming={showTyping && i === visibleMessages.length - 1}
					/>
				))}

				{error && (
					<div
						style={{
							margin: "10px 12px",
							padding: "8px 10px",
							background: "rgba(139,58,42,0.06)",
							border: "1px solid rgba(139,58,42,0.2)",
							borderRadius: "3px",
							fontFamily: "var(--font-courier)",
							fontSize: "10px",
							color: "#8b3a2a",
						}}
					>
						{error}
					</div>
				)}

				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div
				style={{
					borderTop: "1px solid #ddd8ce",
					padding: "10px 12px",
					flexShrink: 0,
					display: "flex",
					gap: "8px",
					alignItems: "flex-end",
					background: "#faf7f2",
				}}
			>
				<textarea
					value={inputVal}
					onChange={(e) => setInputVal(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="Ask about this construct…"
					rows={1}
					disabled={streaming}
					style={{
						flex: 1,
						resize: "none",
						padding: "7px 10px",
						fontFamily: "var(--font-karla)",
						fontSize: "12px",
						color: "#1c1a16",
						background: "#f5f0e8",
						border: "1px solid #ddd8ce",
						borderRadius: "3px",
						outline: "none",
						lineHeight: 1.4,
						maxHeight: "80px",
						overflowY: "auto",
						opacity: streaming ? 0.6 : 1,
					}}
					onInput={(e) => {
						const el = e.target as HTMLTextAreaElement;
						el.style.height = "auto";
						el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
					}}
				/>
				<button
					type="button"
					onClick={handleSend}
					disabled={streaming || !inputVal.trim()}
					style={{
						padding: "7px 12px",
						background: streaming || !inputVal.trim() ? "#c8c0b4" : "#1a4731",
						color: "white",
						fontFamily: "var(--font-courier)",
						fontSize: "9px",
						letterSpacing: "0.1em",
						textTransform: "uppercase",
						border: "none",
						borderRadius: "3px",
						cursor: streaming || !inputVal.trim() ? "not-allowed" : "pointer",
						flexShrink: 0,
						transition: "background 0.1s",
						alignSelf: "flex-end",
					}}
				>
					{streaming ? "…" : "Send"}
				</button>
			</div>

			<style>{`
				@keyframes pulse {
					0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
					40% { opacity: 1; transform: scale(1); }
				}
			`}</style>
		</div>
	);
}
