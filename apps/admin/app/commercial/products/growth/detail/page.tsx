import { Suspense } from "react";

import { GrowthProductEditorClient } from "./growth-product-editor-client";

export default function GrowthProductEditorPage() {
  return (
    <Suspense fallback={null}>
      <GrowthProductEditorClient />
    </Suspense>
  );
}
