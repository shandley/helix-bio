"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Copy a plasmid from the public reference library into the authenticated
 * user's personal sequence library. Returns the new sequence id on success.
 */
export async function saveFromLibrary(slug: string): Promise<{ id?: string; error?: string }> {
	const supabase = await createClient();

	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();
	if (authError || !user) return { error: "Not authenticated" };

	// Fetch plasmid metadata from library table
	const { data: plasmid, error: fetchError } = await supabase
		.from("plasmid_library")
		.select("name, description, topology, length, gc_content, file_path")
		.eq("slug", slug)
		.maybeSingle();

	if (fetchError || !plasmid) return { error: "Plasmid not found" };

	// Fetch the GenBank file from the public bucket
	const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/plasmid-library/${plasmid.file_path}`;
	const fileRes = await fetch(publicUrl);
	if (!fileRes.ok) return { error: "Could not fetch plasmid file" };

	const fileBlob = await fileRes.blob();

	// Upload to the user's sequences bucket
	const fileName = `${user.id}/${randomUUID()}.gb`;
	const { error: uploadError } = await supabase.storage
		.from("sequences")
		.upload(fileName, fileBlob, { contentType: "text/plain" });

	if (uploadError) return { error: uploadError.message };

	// Insert the sequence row
	const { data, error: insertError } = await supabase
		.from("sequences")
		.insert({
			user_id: user.id,
			name: plasmid.name,
			description: plasmid.description || `From Ori reference library`,
			topology: plasmid.topology as "circular" | "linear",
			length: plasmid.length,
			gc_content: plasmid.gc_content,
			file_path: fileName,
			file_format: "genbank",
		})
		.select("id")
		.single();

	if (insertError) return { error: insertError.message };

	revalidatePath("/dashboard");
	return { id: (data as { id: string }).id };
}
