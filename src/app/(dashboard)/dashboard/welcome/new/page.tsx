import {
  listWelcomeTemplates,
  getWelcomeTemplate,
} from "@/features/welcome-documents/server";
import { listClients } from "@/features/clients/server";
import { getClientDisplayName } from "@/features/clients/utils";
import { getProfile } from "@/features/profile/server";
import { WelcomeNewView } from "@/features/welcome-documents/components/welcome-new-view";

interface PageProps {
  searchParams?: Promise<{
    template?: string;
    clientId?: string;
    projectId?: string;
  }>;
}

export const metadata = { title: "New welcome document" };
export const dynamic = "force-dynamic";

/**
 * Template picker → builder. If `?template=<id>` is passed we
 * pre-fill the editor; otherwise we show a curated grid of system +
 * personal templates and a "blank" option.
 */
export default async function NewWelcomeDocumentPage({
  searchParams,
}: PageProps) {
  const sp = (await searchParams) ?? {};
  const [templates, clients, preset, profile] = await Promise.all([
    listWelcomeTemplates(),
    listClients({ limit: 200 }),
    sp.template ? getWelcomeTemplate(sp.template) : Promise.resolve(null),
    getProfile(),
  ]);

  return (
    <WelcomeNewView
      templates={templates}
      preset={preset}
      defaultBrandColor={profile?.brandColor ?? null}
      prefillClientId={sp.clientId ?? null}
      prefillProjectId={sp.projectId ?? null}
      clients={clients.map((c) => ({
        id: c.id,
        name: getClientDisplayName(c),
        email: c.email,
      }))}
    />
  );
}
