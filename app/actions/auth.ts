"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
	const supabase = await createClient();

	const { error } = await supabase.auth.signInWithPassword({
		email: formData.get("email") as string,
		password: formData.get("password") as string,
	});

	if (error) {
		// Surface a friendlier message for the common cases
		if (error.message.toLowerCase().includes("invalid login")) {
			return { error: "Incorrect email or password." };
		}
		return { error: error.message };
	}

	redirect("/dashboard");
}

export async function signup(formData: FormData) {
	const supabase = await createClient();

	const { data, error } = await supabase.auth.signUp({
		email: formData.get("email") as string,
		password: formData.get("password") as string,
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
