"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function deleteSequence(id: string) {
	const supabase = await createClient();

	const { data: rawSeq } = await supabase.from("sequences").select("file_path").eq("id", id).single();
	const seq = rawSeq as { file_path: string | null } | null;

	if (seq?.file_path) {
		await supabase.storage.from("sequences").remove([seq.file_path]);
	}

	const { error } = await supabase.from("sequences").delete().eq("id", id);
	if (error) return { error: error.message };

	revalidatePath("/dashboard");
	return { success: true };
}

export async function updateSequenceName(id: string, name: string) {
	const supabase = await createClient();

	const { error } = await supabase.from("sequences").update({ name }).eq("id", id);
	if (error) return { error: error.message };

	revalidatePath("/dashboard");
	revalidatePath(`/sequence/${id}`);
	return { success: true };
}
