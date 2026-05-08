"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
	const supabase = await createClient();

	const { error } = await supabase.auth.signInWithPassword({
		email: formData.get("email") as string,
		password: formData.get("password") as string,
	});

	if (error) {
		if (error.message.toLowerCase().includes("invalid login") || error.message.toLowerCase().includes("invalid credentials")) {
			return { error: "Incorrect email or password." };
		}
		if (error.message.toLowerCase().includes("email not confirmed")) {
			return { error: "Please confirm your email before signing in. Check your inbox for the confirmation link." };
		}
		return { error: error.message };
	}

	redirect("/dashboard");
}

export async function signup(formData: FormData) {
	const supabase = await createClient();

	// Derive origin from the incoming request so this works on preview deployments too
	const headersList = await headers();
	const origin = headersList.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://ori-bio.vercel.app";

	const { data, error } = await supabase.auth.signUp({
		email: formData.get("email") as string,
		password: formData.get("password") as string,
		options: {
			emailRedirectTo: `${origin}/auth/callback`,
		},
	});

	if (error) {
		if (error.message.toLowerCase().includes("15 seconds") || error.message.toLowerCase().includes("security")) {
			return { error: "Please wait a moment before trying again." };
		}
		if (error.message.toLowerCase().includes("already registered")) {
			return { error: "An account with this email already exists. Sign in instead." };
		}
		return { error: error.message };
	}

	// Session is null when email confirmation is required
	if (!data.session) {
		return { requiresConfirmation: true, email: data.user?.email ?? "" };
	}

	redirect("/dashboard");
}

export async function logout() {
	const supabase = await createClient();
	await supabase.auth.signOut();
	redirect("/login");
}

export async function requestPasswordReset(formData: FormData) {
	const supabase = await createClient();
	const headersList = await headers();
	const origin = headersList.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://ori-bio.vercel.app";
	const email = formData.get("email") as string;

	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${origin}/auth/callback?next=/reset-password`,
	});

	if (error) return { error: error.message };
	return { success: true };
}

export async function updatePassword(formData: FormData) {
	const supabase = await createClient();
	const password = formData.get("password") as string;

	const { error } = await supabase.auth.updateUser({ password });
	if (error) return { error: error.message };

	redirect("/dashboard");
}
