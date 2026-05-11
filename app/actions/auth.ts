"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function signInWithGoogle() {
	const supabase = await createClient();
	// Use the canonical site URL — the origin header is unreliable in server
	// action context (some browsers omit it) and the PKCE redirectTo must
	// exactly match an entry in Supabase's Redirect URLs allowlist.
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ori-bio.app";

	const { data, error } = await supabase.auth.signInWithOAuth({
		provider: "google",
		options: { redirectTo: `${siteUrl}/auth/callback` },
	});

	if (error || !data.url) redirect("/login?error=oauth_failed");
	redirect(data.url);
}

export async function login(formData: FormData) {
	const supabase = await createClient();

	const { error } = await supabase.auth.signInWithPassword({
		email: formData.get("email") as string,
		password: formData.get("password") as string,
	});

	if (error) {
		if (
			error.message.toLowerCase().includes("invalid login") ||
			error.message.toLowerCase().includes("invalid credentials")
		) {
			return { error: "Incorrect email or password." };
		}
		if (error.message.toLowerCase().includes("email not confirmed")) {
			return {
				error:
					"Please confirm your email before signing in. Check your inbox for the confirmation link.",
			};
		}
		return { error: error.message };
	}

	redirect("/dashboard");
}

export async function signup(formData: FormData) {
	const supabase = await createClient();

	// Derive origin from the incoming request so this works on preview deployments too
	const headersList = await headers();
	const origin =
		headersList.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://ori-bio.app";

	const { data, error } = await supabase.auth.signUp({
		email: formData.get("email") as string,
		password: formData.get("password") as string,
		options: {
			emailRedirectTo: `${origin}/auth/callback`,
		},
	});

	if (error) {
		if (
			error.message.toLowerCase().includes("15 seconds") ||
			error.message.toLowerCase().includes("security")
		) {
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

export async function deleteAccount(): Promise<{ error: string } | never> {
	const supabase = await createClient();

	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Not authenticated." };

	// 1. Collect all storage files owned by this user
	const { data: files } = await supabase.storage
		.from("sequences")
		.list(user.id, { limit: 1000 });

	if (files && files.length > 0) {
		const paths = files.map((f) => `${user.id}/${f.name}`);
		await supabase.storage.from("sequences").remove(paths);
	}

	// 2. Hard-delete all sequence rows (including soft-deleted)
	await supabase.from("sequences").delete().eq("user_id", user.id);

	// 3. Delete the auth user — requires service role key
	const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!serviceKey) return { error: "Server configuration error. Contact support." };

	const admin = createAdminClient(adminUrl, serviceKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
	const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
	if (deleteError) return { error: deleteError.message };

	// 4. Sign out locally and redirect home
	await supabase.auth.signOut();
	redirect("/");
}

export async function requestPasswordReset(formData: FormData) {
	const supabase = await createClient();
	const headersList = await headers();
	const origin =
		headersList.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://ori-bio.app";
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
