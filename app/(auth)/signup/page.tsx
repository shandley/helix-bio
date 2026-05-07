"use client";

import { useState } from "react";
import Link from "next/link";
import { signup } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function SignupPage() {
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [confirmedEmail, setConfirmedEmail] = useState<string | null>(null);

	async function handleSubmit(formData: FormData) {
		setLoading(true);
		setError(null);
		const result = await signup(formData);
		if (result?.error) {
			setError(result.error);
			setLoading(false);
			return;
		}
		if (result?.requiresConfirmation) {
			setConfirmedEmail(result.email);
			setLoading(false);
		}
	}

	if (confirmedEmail) {
		return (
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Check your email</CardTitle>
					<CardDescription>We sent a confirmation link to {confirmedEmail}.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Click the link in the email to activate your account. Check your spam folder if you
						don&apos;t see it within a minute.
					</p>
					<Link href="/login" className={cn(buttonVariants(), "w-full justify-center")}>
						Go to sign in
					</Link>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="w-full max-w-sm">
			<CardHeader>
				<CardTitle>Create account</CardTitle>
				<CardDescription>Start visualizing and simulating DNA constructs.</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={handleSubmit} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="email">Email</Label>
						<Input id="email" name="email" type="email" placeholder="you@lab.edu" required />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="password">Password</Label>
						<Input
							id="password"
							name="password"
							type="password"
							placeholder="8+ characters"
							minLength={8}
							required
						/>
					</div>
					{error && <p className="text-sm text-destructive">{error}</p>}
					<Button type="submit" className="w-full" disabled={loading}>
						{loading ? "Creating account…" : "Create account"}
					</Button>
				</form>
				<p className="mt-4 text-center text-sm text-muted-foreground">
					Already have an account?{" "}
					<Link href="/login" className={cn(buttonVariants({ variant: "link" }), "h-auto p-0")}>
						Sign in
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
