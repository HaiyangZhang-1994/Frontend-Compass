import { describe, expect, it } from "vitest";
import { extractVueComponents } from "../../../src/analyzers/vue/extract-components.js";

describe("extractVueComponents", () => {
  it("captures child components and composable usage from a Vue SFC", () => {
    const result = extractVueComponents(`
      <script setup lang="ts">
      const session = useSession()
      </script>
      <template>
        <ProfileCard />
      </template>
    `);

    expect(result.composables).toContain("useSession");
    expect(result.childComponents).toContain("ProfileCard");
  });
});
