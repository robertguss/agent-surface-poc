import { Workbench } from "@/components/workbench";
import { createCompiledExperience } from "@/lib/experience";
import {
  sampleIntentSpec,
  sampleIntentText,
  sampleSurfaceSpec,
} from "@/lib/sample";

export default function Home() {
  const initialExperience = createCompiledExperience(
    sampleIntentSpec,
    sampleSurfaceSpec,
  );

  return (
    <Workbench
      initialIntent={sampleIntentText}
      initialExperience={initialExperience}
    />
  );
}
