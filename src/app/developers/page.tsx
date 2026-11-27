import { DevelopersTools } from "@/components/developers/developers-tools";
import { getConfig } from "@/lib/config";

export default async function DevelopersPage() {
  const config = await getConfig();
  return <DevelopersTools promptEnhancerEnabled={config.features.promptEnhancer !== false} />;
}
