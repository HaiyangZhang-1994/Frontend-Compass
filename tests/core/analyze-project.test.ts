import { describe, expect, it } from "vitest";
import { analyzeProject } from "../../src/core/analyze-project.js";

describe("analyzeProject", () => {
  it("builds a normalized snapshot for a Next.js project", () => {
    const snapshot = analyzeProject({
      projectRoot: "/demo/next-app",
      packageJson: {
        dependencies: { next: "15.0.0", react: "19.0.0" },
      },
      files: ["app/page.tsx"],
      sourceByFile: {
        "app/page.tsx": `
          export default function HomePage() {
            const [open, setOpen] = useState(false);
            useEffect(() => { fetch("/api/home"); }, []);
            return <HeroPanel />;
          }
        `,
      },
    });

    expect(snapshot.framework).toBe("next");
    expect(snapshot.routes.map((route) => route.path)).toEqual(["/"]);
    expect(snapshot.pages[0]?.components.componentNames).toContain("HomePage");
    expect(snapshot.apiCalls[0]?.target).toContain("/api/home");
    expect(snapshot.stateUnits).toContain("useState");
  });

  it("builds a normalized snapshot for a Nuxt project", () => {
    const snapshot = analyzeProject({
      projectRoot: "/demo/nuxt-app",
      packageJson: {
        dependencies: { nuxt: "4.0.0", vue: "3.0.0" },
      },
      files: ["pages/index.vue"],
      sourceByFile: {
        "pages/index.vue": `
          <script setup lang="ts">
          const open = ref(false)
          watch(open, () => $fetch("/api/home"))
          </script>
          <template>
            <HeroPanel />
          </template>
        `,
      },
    });

    expect(snapshot.framework).toBe("nuxt");
    expect(snapshot.routes.map((route) => route.path)).toEqual(["/"]);
    expect(snapshot.pages[0]?.components.childComponents).toContain("HeroPanel");
    expect(snapshot.apiCalls[0]?.target).toContain("/api/home");
    expect(snapshot.stateUnits).toContain("ref");
  });

  it("maps template navigation targets to dynamic route paths", () => {
    const snapshot = analyzeProject({
      projectRoot: "/demo/next-app",
      packageJson: {
        dependencies: { next: "15.0.0", react: "19.0.0" },
      },
      files: ["app/page.tsx", "app/chat/[id]/page.tsx"],
      sourceByFile: {
        "app/page.tsx": `
          export default function HomePage() {
            return <button onClick={() => router.push(\`/chat/\${reportId}\`)}>Go</button>;
          }
        `,
        "app/chat/[id]/page.tsx": `
          export default function ChatPage() {
            return null;
          }
        `,
      },
    });

    expect(snapshot.navigationEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "/",
          to: "/chat/[id]",
          type: "router-push",
        }),
      ]),
    );
  });

  it("maps redirect template targets to dynamic route paths", () => {
    const snapshot = analyzeProject({
      projectRoot: "/demo/next-app",
      packageJson: {
        dependencies: { next: "15.0.0", react: "19.0.0" },
      },
      files: ["app/reports/[id]/page.tsx", "app/chat/[id]/page.tsx"],
      sourceByFile: {
        "app/reports/[id]/page.tsx": `
          export default async function ReportPage({ params }) {
            const { id } = await params;
            redirect(\`/chat/\${id}\`);
            return null;
          }
        `,
        "app/chat/[id]/page.tsx": `
          export default function ChatPage() {
            return null;
          }
        `,
      },
    });

    expect(snapshot.navigationEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "/reports/[id]",
          to: "/chat/[id]",
          type: "navigate",
        }),
      ]),
    );
  });

  it("extracts navigation from locally imported page components", () => {
    const snapshot = analyzeProject({
      projectRoot: "/demo/next-app",
      packageJson: {
        dependencies: { next: "15.0.0", react: "19.0.0" },
      },
      files: ["app/page.tsx", "components/search-form.tsx", "app/chat/[id]/page.tsx"],
      sourceByFile: {
        "app/page.tsx": `
          import { SearchForm } from "../components/search-form";
          export default function HomePage() {
            return <SearchForm />;
          }
        `,
        "components/search-form.tsx": `
          export function SearchForm() {
            router.push(\`/chat/\${reportId}\`);
            return null;
          }
        `,
        "app/chat/[id]/page.tsx": `
          export default function ChatPage() {
            return null;
          }
        `,
      },
    });

    expect(snapshot.navigationEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: "/",
          to: "/chat/[id]",
          type: "router-push",
        }),
      ]),
    );
  });
});
