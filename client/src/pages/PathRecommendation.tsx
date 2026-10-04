import React, { useState } from "react";
import Layout from "@/components/Layout";
import CostNote from "@/components/CostNote";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GraduationCap, BookOpen, Code, Briefcase, ArrowRight, Loader2, X, Target, Search, ListChecks } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";

interface Skill {
  name: string;
  proficiency: number;
}

interface CareerPath {
  title: string;
  description: string;
  matchScore: number;
  whyGoodFit: string;
  skills: string[];
  skillGaps: string[];
  timeline: string;
  avgSalary: string;
  growthRate: string;
}

interface LearningResource {
  title: string;
  type: string;
  provider: string;
  difficulty: string;
  url: string;
  rating: number;
  reason: string;
  link_verified?: boolean;
}

interface SkillToLearn {
  name: string;
  priority: string;
  category: string;
  reason: string;
}

interface Recommendations {
  summary: string;
  careerPaths: CareerPath[];
  learningResources: LearningResource[];
  skillsToLearn: SkillToLearn[];
  nextSteps: string[];
}

const level = (p: number) => (p < 40 ? "Beginner" : p <= 70 ? "Working knowledge" : "Strong");

const PathRecommendation: React.FC = () => {
  const { toast } = useToast();
  const [skills, setSkills] = useState<Skill[]>([
    { name: "JavaScript", proficiency: 60 },
    { name: "HTML/CSS", proficiency: 70 },
  ]);
  const [newSkill, setNewSkill] = useState("");
  const [goal, setGoal] = useState("");
  const [experience, setExperience] = useState("");
  const [location, setLocation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recs, setRecs] = useState<Recommendations | null>(null);

  const addSkill = () => {
    const name = newSkill.trim();
    if (name && !skills.some((s) => s.name.toLowerCase() === name.toLowerCase()) && skills.length < 25) {
      setSkills([...skills, { name, proficiency: 50 }]);
    }
    setNewSkill("");
  };

  const generate = async () => {
    if (skills.length === 0) {
      toast({ title: "Add at least one skill", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data } = await api.post<Recommendations>("/api/career/recommendations", { skills, goal, experience, location });
      setRecs(data);
      setTimeout(() => document.getElementById("recommendations")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not generate recommendations", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const categories = recs ? Array.from(new Set(recs.skillsToLearn.map((s) => s.category))) : [];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto px-2 sm:px-6 py-4">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Career Path Recommendations</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" /> Your skills
              </CardTitle>
              <CardDescription>Rate yourself honestly. It makes the recommendations far more useful.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <Input
                  placeholder="Add a skill (e.g. Python, Docker, AWS)"
                  value={newSkill}
                  maxLength={60}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addSkill()}
                />
                <Button onClick={addSkill} className="sm:w-auto">
                  Add skill
                </Button>
              </div>
              <div className="space-y-3">
                {skills.map((skill, index) => (
                  <div key={skill.name} className="bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-sm">{skill.name}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {skill.proficiency}% · {level(skill.proficiency)}
                        </span>
                        <button
                          className="text-gray-400 hover:text-red-500"
                          onClick={() => setSkills(skills.filter((_, i) => i !== index))}
                          aria-label={`Remove ${skill.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={skill.proficiency}
                      onChange={(e) =>
                        setSkills(skills.map((s, i) => (i === index ? { ...s, proficiency: parseInt(e.target.value) } : s)))
                      }
                      className="w-full accent-primary"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" /> Your goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="goal">Career goal</Label>
                <Input id="goal" placeholder="e.g. Become an ML engineer" value={goal} maxLength={300} onChange={(e) => setGoal(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Experience</Label>
                <Select value={experience} onValueChange={setExperience}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Student", "0-2 years", "2-5 years", "5-10 years", "10+ years", "Career switcher"].map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" placeholder="e.g. Bangalore, India" value={location} maxLength={100} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button className="w-full" onClick={generate} disabled={isLoading || skills.length === 0}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {isLoading ? "Analysing your profile..." : "Get recommendations"}
              </Button>
              <CostNote action="career_recommendations" />
            </CardFooter>
          </Card>
        </div>

        {recs && (
          <div id="recommendations" className="space-y-6">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6 space-y-4">
                <p className="text-gray-800">{recs.summary}</p>
                <div>
                  <h3 className="font-semibold flex items-center gap-2 mb-2">
                    <ListChecks className="h-4 w-4" /> Your next 30 days
                  </h3>
                  <ol className="list-decimal pl-5 text-sm space-y-1">
                    {recs.nextSteps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="paths">
              <TabsList className="grid grid-cols-3 w-full mb-6">
                <TabsTrigger value="paths" className="gap-2">
                  <Briefcase className="h-4 w-4" /> <span className="hidden sm:inline">Career paths</span>
                  <span className="sm:hidden">Paths</span>
                </TabsTrigger>
                <TabsTrigger value="resources" className="gap-2">
                  <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Resources</span>
                  <span className="sm:hidden">Learn</span>
                </TabsTrigger>
                <TabsTrigger value="skills" className="gap-2">
                  <Code className="h-4 w-4" /> <span className="hidden sm:inline">Skills to develop</span>
                  <span className="sm:hidden">Skills</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="paths">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {recs.careerPaths.map((path) => (
                    <Card key={path.title} className="flex flex-col">
                      <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-lg">{path.title}</CardTitle>
                          <Badge variant="secondary">{path.matchScore}% fit</Badge>
                        </div>
                        <Progress value={path.matchScore} className="h-1.5" />
                        <CardDescription>{path.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-4 text-sm">
                        <p className="text-gray-700">
                          <strong>Why it fits:</strong> {path.whyGoodFit}
                        </p>
                        <div>
                          <h4 className="text-xs font-medium text-gray-500 mb-1">Key skills</h4>
                          <div className="flex flex-wrap gap-1">
                            {path.skills.map((s) => (
                              <Badge key={s} variant="outline">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {path.skillGaps.length > 0 && (
                          <div>
                            <h4 className="text-xs font-medium text-gray-500 mb-1">Your gaps</h4>
                            <div className="flex flex-wrap gap-1">
                              {path.skillGaps.map((s) => (
                                <Badge key={s} className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                                  {s}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t">
                          <div>
                            <h4 className="text-xs text-gray-500">Time to job-ready</h4>
                            <p>{path.timeline}</p>
                          </div>
                          <div>
                            <h4 className="text-xs text-gray-500">Typical salary</h4>
                            <p>{path.avgSalary}</p>
                          </div>
                          <div>
                            <h4 className="text-xs text-gray-500">Outlook</h4>
                            <p className="text-green-700">{path.growthRate}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-4">Salary and outlook figures are AI estimates for guidance only.</p>
              </TabsContent>

              <TabsContent value="resources">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {recs.learningResources.map((r) => (
                    <Card key={r.title} className="flex flex-col">
                      <CardHeader>
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <CardTitle className="text-base">{r.title}</CardTitle>
                            <CardDescription>
                              {r.provider} · {r.type}
                            </CardDescription>
                          </div>
                          <Badge className={r.difficulty === "Beginner" ? "bg-green-500" : r.difficulty === "Intermediate" ? "bg-amber-500" : "bg-red-500"}>
                            {r.difficulty}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-grow text-sm text-gray-600">
                        <p>{r.reason}</p>
                        <p className="mt-2 text-amber-600">★ {r.rating.toFixed(1)}</p>
                      </CardContent>
                      <CardFooter>
                        <Button className="w-full" variant="outline" onClick={() => window.open(r.url, "_blank", "noopener")}>
                          {r.link_verified === false ? <Search className="mr-2 h-4 w-4" /> : null}
                          {r.link_verified === false ? "Find this resource" : "Visit resource"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="skills">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {categories.map((category) => (
                    <Card key={category}>
                      <CardHeader>
                        <CardTitle className="text-base">{category}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-3">
                          {recs.skillsToLearn
                            .filter((s) => s.category === category)
                            .map((s) => (
                              <li key={s.name} className="border-b pb-2">
                                <div className="flex justify-between items-center gap-2">
                                  <span className="font-medium">{s.name}</span>
                                  <Badge variant={s.priority === "High" ? "default" : "outline"}>{s.priority} priority</Badge>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">{s.reason}</p>
                              </li>
                            ))}
                        </ul>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PathRecommendation;
