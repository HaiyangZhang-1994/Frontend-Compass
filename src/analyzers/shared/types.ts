export type SupportedFramework = "react" | "next" | "vue" | "nuxt";

export type AnalysisRoute = {
  file: string;
  path: string;
};

export type AnalysisPage = {
  file: string;
  path: string;
  components: {
    componentNames?: string[];
    childComponents: string[];
    customHooks?: string[];
    composables?: string[];
  };
  dataFlow: {
    effects?: string[];
    watchers?: string[];
    stateHooks?: string[];
    stateSignals?: string[];
    handlers?: string[];
    navigationCalls?: Array<{
      to: string;
      type: NavigationEdgeType;
      evidence: string;
      sourceFile?: string;
      line?: number;
    }>;
    apiCalls: Array<{ target: string }>;
  };
};

export type NavigationEdgeType =
  | "link"
  | "anchor"
  | "router-push"
  | "router-replace"
  | "navigate"
  | "navigate-to";

export type AnalysisNavigationEdge = {
  from: string;
  to: string;
  type: NavigationEdgeType;
  evidence: string;
  sourceFile?: string;
  line?: number;
};

export type AnalysisSnapshot = {
  framework: SupportedFramework;
  routes: AnalysisRoute[];
  pages: AnalysisPage[];
  components: string[];
  apiCalls: Array<{ target: string; file: string; path: string }>;
  stateUnits: string[];
  navigationEdges?: AnalysisNavigationEdge[];
  unsupportedReason?: string;
};
