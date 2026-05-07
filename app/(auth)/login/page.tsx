"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const URL_ERROR_MESSAGES: Record<string, string> = {
	confirmation_failed: "That confirmation link is invalid or has expired. Please sign up again to get a new one.",
	otp_expired: "That confirmation link has expired. Please sign up again to get a new one.",
	access_denied: "That confirmation link is no longer valid. Please sign up again.",
};

function LoginForm() {
	const searchParams = useSearchParams();
	const urlError = searchParams.get("error_code") ?? searchParams.get("error") ?? null;
	const urlErrorMessage = urlError ? (URL_ERROR_MESSAGES[urlError] ?? "Something went wrong. Please try again.") : null;

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
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Sign in</CardTitle>
				<CardDescription>Enter your email and password to continue.</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="email">Email</Label>
						<Input id="email" name="email" type="email" placeholder="you@lab.edu" required />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="password">Password</Label>
						<Input id="password" name="password" type="password" required />
					</div>
					{error && <p className="text-sm text-destructive">{error}</p>}
					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Signing in…" : "Sign in"}
					</Button>
				</form>
				<p className="mt-4 text-center text-sm text-muted-foreground">
					No account?{" "}
					<Link href="/signup" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}>
						Sign up
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}

export default function LoginPage() {
	return (
		<Suspense>
			<LoginForm />
		</Suspense>
	);
}
