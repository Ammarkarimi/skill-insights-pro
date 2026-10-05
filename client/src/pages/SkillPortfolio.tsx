import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import ProofTest from "@/components/portfolio/ProofTest";
import ProjectsTab, { GithubStatus } from "@/components/portfolio/ProjectsTab";
import PortfolioSettings from "@/components/portfolio/PortfolioSettings";

const GITHUB_MESSAGES: Record<string, { title: string; description?: string; variant?: "destructive" }> = {
  connected: { title: "GitHub connected", description: "Projects you own or contributed to will now be verified." },
  taken: { title: "That GitHub account is already linked", description: "It is connected to another SkillSphere account.", variant: "destructive" },
  error: { title: "GitHub connection failed", description: "Please try again.", variant: "destructive" },
};

const SkillPortfolio: React.FC = () => {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("github") ? "projects" : params.get("tab") || "prove");
  const [github, setGithub] = useState<GithubStatus | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const prove = params.get("prove") || "";

  const loadGithub = useCallback(
    () =>
      api
        .get<GithubStatus>("/api/github/status")
        .then((r) => setGithub(r.data))
        .catch(() => setGithub(null)),
    [],
  );

  useEffect(() => {
    loadGithub();
    const result = params.get("github");
    if (result && GITHUB_MESSAGES[result]) {
      toast(GITHUB_MESSAGES[result]);
      params.delete("github");
      setParams(params, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="page-header">Skill Portfolio</h1>
        <p className="text-gray-600 -mt-4 mb-6">
          Turn skills into proof: timed adaptive tests and reviewed GitHub projects, on a page you can share with recruiters.
        </p>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="prove">Prove a skill</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="portfolio" onClick={() => setRefreshKey((k) => k + 1)}>
              My portfolio
            </TabsTrigger>
          </TabsList>
          <TabsContent value="prove" className="max-w-3xl">
            <ProofTest initialSkill={prove} onCompleted={() => setRefreshKey((k) => k + 1)} />
          </TabsContent>
          <TabsContent value="projects">
            <ProjectsTab github={github} onGithubChange={loadGithub} />
          </TabsContent>
          <TabsContent value="portfolio">
            <PortfolioSettings refreshKey={refreshKey} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SkillPortfolio;
