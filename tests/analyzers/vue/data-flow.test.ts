import { describe, expect, it } from "vitest";
import { extractVueDataFlow } from "../../../src/analyzers/vue/extract-data-flow.js";

describe("extractVueDataFlow", () => {
  it("captures watch and fetch usage in Vue source", () => {
    const result = extractVueDataFlow(`
      <script setup lang="ts">
      watch(userId, () => $fetch("/api/user"))
      </script>
    `);

    expect(result.watchers).toHaveLength(1);
    expect(result.apiCalls[0].target).toContain("/api/user");
  });

  it("captures ref, computed, and api client usage", () => {
    const result = extractVueDataFlow(`
      <script setup lang="ts">
      const open = ref(false)
      const label = computed(() => open.value ? "On" : "Off")
      apiClient.get("/api/settings")
      </script>
    `);

    expect(result.stateSignals).toContain("ref");
    expect(result.stateSignals).toContain("computed");
    expect(result.apiCalls[0].target).toContain("/api/settings");
  });

  it("extracts deterministic navigation calls and ignores dynamic targets", () => {
    const result = extractVueDataFlow(`
      <template>
        <NuxtLink to="/orders">Orders</NuxtLink>
        <RouterLink to="/account">Account</RouterLink>
        <a href="/help">Help</a>
      </template>
      <script setup lang="ts">
      router.push("/checkout")
      navigateTo("/welcome")
      navigateTo(targetPath)
      </script>
    `);

    expect(result.navigationCalls.map((entry) => entry.to)).toEqual([
      "/orders",
      "/account",
      "/help",
      "/checkout",
      "/welcome",
    ]);
  });

  it("extracts brace-wrapped router links and normalizes trailing slash", () => {
    const result = extractVueDataFlow(`
      <template>
        <RouterLink to={"/profile/"}>Profile</RouterLink>
      </template>
    `);

    expect(result.navigationCalls[0]?.to).toBe("/profile");
  });
});
