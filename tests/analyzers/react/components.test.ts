import { describe, expect, it } from "vitest";
import { extractReactComponents } from "../../../src/analyzers/react/extract-components.js";

describe("extractReactComponents", () => {
  it("captures component names and custom hook usage hints", () => {
    const result = extractReactComponents(`
      export default function ProfilePage() {
        const session = useSession();
        return <ProfileCard />;
      }
    `);

    expect(result.componentNames).toContain("ProfilePage");
    expect(result.customHooks).toContain("useSession");
    expect(result.childComponents).toContain("ProfileCard");
  });
});
