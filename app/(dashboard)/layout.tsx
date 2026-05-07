import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TopNav } from "@/components/nav/top-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/login");

	return (
		<div className="flex h-full flex-col">
			<TopNav userEmail={user.email ?? ""} />
			<main className="flex-1 overflow-auto">{children}</main>
		</div>
	);
}
