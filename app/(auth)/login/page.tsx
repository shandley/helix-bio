"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function LoginPage() {
	const [error, setError] = useState<string | null>(null);
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
