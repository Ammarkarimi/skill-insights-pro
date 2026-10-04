import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import CostNote from "@/components/CostNote";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Search, TrendingUp, MapPin, Building, Loader2, Sparkles, Database, Lightbulb, Briefcase } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";

const COLORS = ["#6366F1", "#8B5CF6", "#A78BFA", "#818CF8", "#93C5FD", "#C4B5FD", "#60A5FA"];
const QUICK_SKILLS = ["Python", "React", "AWS", "Data Science", "DevOps", "Java", "Machine Learning"];

interface Country {
  code: string;
  name: string;
  currency: string;
}

interface Report {
  skill: string;
  countryName: string;
  currency: string;
  liveSource: string | null;
  live: {
    totalJobs: number;
    averageSalary: number | null;
    locations: { name: string; jobs: number }[];
    salaryHistory: { month: string; salary: number }[];
    topCompanies: { name: string; jobs: number; averageSalary: number }[];
  } | null;
  insights: {
    summary: string;
    demandLevel: string;
    outlook: string;
    salaryBands: { entry: string; mid: string; senior: string };
    hiringHubs: { city: string; demand: string; note: string }[];
    industries: { name: string; share: number }[];
    relatedSkills: { name: string; reason: string }[];
    topRoles: string[];
    tips: string[];
  };
}

const JobMarket: React.FC = () => {
  const { toast } = useToast();
  const [skill, setSkill] = useState("");
  const [country, setCountry] = useState("us");
  const [countries, setCountries] = useState<Country[]>([]);
  const [liveAvailable, setLiveAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    api
      .get<{ countries: Country[]; liveData: boolean }>("/api/market/countries")
      .then((r) => {
        setCountries(r.data.countries);
        setLiveAvailable(r.data.liveData);
      })
      .catch(() => undefined);
  }, []);

  const fetchReport = async (skillName = skill) => {
    const name = skillName.trim();
    if (!name) return;
    setSkill(name);
    setIsLoading(true);
    try {
      const { data } = await api.get<Report>("/api/market/insights", { params: { skill: name, country } });
      setReport(data);
    } catch (err) {
      if (!isInsufficientCredits(err)) toast({ title: "Could not load market data", description: apiErrorMessage(err), variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const money = (n: number | null | undefined, currency: string) =>
    n ? new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n) : "n/a";

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-2 sm:px-6">
        <h1 className="page-header">Job Market Analysis</h1>

        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  placeholder="Skill or technology, e.g. Kubernetes"
                  className="pl-10"
                  value={skill}
                  maxLength={60}
                  onChange={(e) => setSkill(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchReport()}
                />
              </div>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="md:w-56">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => fetchReport()} disabled={isLoading || !skill.trim()}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                Analyse market
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-500">Popular:</span>
              {QUICK_SKILLS.map((s) => (
                <Button key={s} size="sm" variant="outline" className="h-7 text-xs" disabled={isLoading} onClick={() => fetchReport(s)}>
                  {s}
                </Button>
              ))}
              <span className="ml-auto">
                <CostNote action="market_insights" /> <span className="text-xs text-muted-foreground">(repeat lookups within 6h are free)</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <span className="text-gray-600">Analysing the {skill} market…</span>
          </div>
        )}

        {!isLoading && !report && (
          <div className="text-center text-gray-500 py-16">
            Search for a skill to see demand, salaries, hiring hubs and related skills.
            {!liveAvailable && <div className="text-xs mt-2">Market figures are AI estimates.</div>}
          </div>
        )}

        {!isLoading && report && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold">
                {report.skill} in {report.countryName}
              </h2>
              <Badge className="bg-primary">{report.insights.demandLevel} demand</Badge>
              {report.live ? (
                <Badge variant="outline" className="gap-1">
                  <Database className="h-3 w-3" /> Live job data: {report.liveSource}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Sparkles className="h-3 w-3" /> AI estimates
                </Badge>
              )}
            </div>

            {report.live && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-500">Open job postings</div>
                    <div className="text-3xl font-bold">{report.live.totalJobs.toLocaleString()}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-500">Average advertised salary</div>
                    <div className="text-3xl font-bold">{money(report.live.averageSalary, report.currency)}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm text-gray-500">Top hiring location</div>
                    <div className="text-2xl font-bold">{report.live.locations[0]?.name ?? "n/a"}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" /> Market overview
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3 text-gray-700">
                  <p>{report.insights.summary}</p>
                  <p>
                    <strong>Outlook:</strong> {report.insights.outlook}
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Typical salary bands {report.live ? "" : "(AI estimate)"}</h3>
                  <Table>
                    <TableBody>
                      {(["entry", "mid", "senior"] as const).map((k) => (
                        <TableRow key={k}>
                          <TableCell className="capitalize font-medium">{k === "mid" ? "Mid-level" : k}</TableCell>
                          <TableCell>{report.insights.salaryBands[k]}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5 text-primary" /> {report.live ? "Openings by location" : "Hiring hubs"}
                  </CardTitle>
                  <CardDescription>{report.live ? `Live postings from ${report.liveSource}` : "Where demand is concentrated (AI estimate)"}</CardDescription>
                </CardHeader>
                <CardContent>
                  {report.live && report.live.locations.length > 0 ? (
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={report.live.locations} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
                          <Tooltip />
                          <Bar dataKey="jobs" name="Open jobs" fill="#6366F1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {report.insights.hiringHubs.map((h) => (
                        <li key={h.city} className="flex justify-between gap-3 border-b pb-2">
                          <span>
                            <span className="font-medium">{h.city}</span>
                            <span className="block text-xs text-gray-500">{h.note}</span>
                          </span>
                          <Badge variant="secondary" className="h-fit shrink-0">
                            {h.demand}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building className="h-5 w-5 text-primary" /> Industries hiring
                  </CardTitle>
                  <CardDescription>Approximate share of demand (AI estimate)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={report.insights.industries} dataKey="share" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45}>
                          {report.insights.industries.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `${v}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {report.insights.industries.map((ind, i) => (
                      <div key={ind.name} className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {ind.name} ({ind.share}%)
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {report.live && report.live.salaryHistory.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-primary" /> Average advertised salary over time
                  </CardTitle>
                  <CardDescription>Monthly average from live postings ({report.currency})</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={report.live.salaryHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                        <Tooltip formatter={(v: number) => money(v, report.currency)} />
                        <Line type="monotone" dataKey="salary" stroke="#6366F1" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {report.live && report.live.topCompanies.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Briefcase className="h-5 w-5 text-primary" /> Top hiring companies
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Open roles</TableHead>
                        <TableHead>Avg. salary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.live.topCompanies.map((c) => (
                        <TableRow key={c.name}>
                          <TableCell>{c.name}</TableCell>
                          <TableCell>{c.jobs}</TableCell>
                          <TableCell>{money(c.averageSalary, report.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Skills that pair well with {report.skill}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.insights.relatedSkills.map((s) => (
                    <div key={s.name} className="border rounded-md p-3">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-gray-500">{s.reason}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Roles &amp; tips</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex flex-wrap gap-2">
                    {report.insights.topRoles.map((r) => (
                      <Badge key={r} variant="secondary">
                        {r}
                      </Badge>
                    ))}
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {report.insights.tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Alert>
              <AlertDescription className="text-xs">
                {report.live
                  ? `Job counts, salaries and companies come from live ${report.liveSource} postings. Narrative, salary bands and industry shares are AI estimates.`
                  : "All figures on this page are AI estimates based on general market knowledge, not live job listings. Use them for direction, not exact numbers."}
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default JobMarket;
