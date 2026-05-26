import { describe, expect, it } from "vitest";
import { extractReactDataFlow } from "../../../src/analyzers/react/extract-data-flow.js";

describe("extractReactDataFlow", () => {
  it("captures useEffect and fetch hints from page content", () => {
    const result = extractReactDataFlow(`
      export default function Page() {
        useEffect(() => { fetch("/api/profile"); }, []);
        return null;
      }
    `);

    expect(result.effects).toHaveLength(1);
    expect(result.apiCalls[0].target).toContain("/api/profile");
  });

  it("captures custom api client calls and useState hints", () => {
    const result = extractReactDataFlow(`
      export function SettingsPage() {
        const [open, setOpen] = useState(false);
        apiClient.get("/api/settings");
        return null;
      }
    `);

    expect(result.stateHooks).toContain("useState");
    expect(result.apiCalls[0].target).toContain("/api/settings");
  });

  it("extracts deterministic navigation calls and ignores dynamic targets", () => {
    const result = extractReactDataFlow(`
      export function HomePage() {
        return (
          <>
            <Link href="/settings">Settings</Link>
            <a href="/profile">Profile</a>
          </>
        );
      }
      function go() {
        router.push("/billing");
        router.replace("/profile");
        navigate("/support");
        navigate(nextPath);
      }
    `);

    expect(result.navigationCalls.map((entry) => entry.to)).toEqual([
      "/settings",
      "/profile",
      "/billing",
      "/profile",
      "/support",
    ]);
  });

  it("extracts brace-wrapped link href and normalizes trailing slash", () => {
    const result = extractReactDataFlow(`
      export function HomePage() {
        return <Link href={"/settings/"}>Settings</Link>;
      }
    `);

    expect(result.navigationCalls[0]?.to).toBe("/settings");
  });

  it("extracts redirect template literals as deterministic navigation candidates", () => {
    const result = extractReactDataFlow(`
      export default function ReportPage() {
        redirect(\`/chat/\${id}\`);
        return null;
      }
    `);

    expect(result.navigationCalls[0]?.to).toBe("/chat/${id}");
    expect(result.navigationCalls[0]?.type).toBe("navigate");
  });
});
