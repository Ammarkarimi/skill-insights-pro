import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Search,
  TrendingUp,
  MapPin,
  Building,
  BarChart3,
  Loader2,
} from "lucide-react";
import axios from "axios";

const COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#A78BFA",
  "#C4B5FD",
  "#818CF8",
  "#93C5FD",
  "#BAE6FD",
  "#E0F2FE",
];

// Sample data for development and fallback
const sampleSkillTrends = [
  { name: "Jan", JavaScript: 65, Python: 45, React: 55, AWS: 35 },
  { name: "Feb", JavaScript: 68, Python: 48, React: 58, AWS: 38 },
  { name: "Mar", JavaScript: 70, Python: 52, React: 60, AWS: 40 },
  { name: "Apr", JavaScript: 73, Python: 56, React: 62, AWS: 42 },
  { name: "May", JavaScript: 75, Python: 60, React: 65, AWS: 45 },
  { name: "Jun", JavaScript: 78, Python: 62, React: 68, AWS: 48 },
  { name: "Jul", JavaScript: 80, Python: 65, React: 70, AWS: 50 },
  { name: "Aug", JavaScript: 82, Python: 68, React: 72, AWS: 52 },
  { name: "Sep", JavaScript: 85, Python: 70, React: 75, AWS: 55 },
  { name: "Oct", JavaScript: 88, Python: 72, React: 78, AWS: 58 },
  { name: "Nov", JavaScript: 90, Python: 75, React: 80, AWS: 60 },
  { name: "Dec", JavaScript: 92, Python: 78, React: 82, AWS: 62 },
];

const sampleTopSkills = [
  { name: "JavaScript", value: 92 },
  { name: "Python", value: 78 },
  { name: "React", value: 82 },
  { name: "AWS", value: 62 },
  { name: "TypeScript", value: 75 },
  { name: "Node.js", value: 70 },
  { name: "SQL", value: 65 },
  { name: "Docker", value: 58 },
];

const sampleLocationDemand = [
  { name: "San Francisco", jobs: 12500 },
  { name: "New York", jobs: 11200 },
  { name: "Seattle", jobs: 10800 },
  { name: "Austin", jobs: 8900 },
  { name: "Boston", jobs: 7600 },
  { name: "Chicago", jobs: 6800 },
  { name: "Los Angeles", jobs: 6200 },
  { name: "Denver", jobs: 5500 },
];

const sampleIndustryDistribution = [
  { name: "Technology", value: 35 },
  { name: "Finance", value: 20 },
  { name: "Healthcare", value: 15 },
  { name: "Retail", value: 10 },
  { name: "Education", value: 8 },
  { name: "Manufacturing", value: 7 },
  { name: "Government", value: 5 },
];

const JobMarket = () => {
  // State variables
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("all");
  const [selectedSkill, setSelectedSkill] = useState("JavaScript");
  const [activeTab, setActiveTab] = useState("trends");

  // Data state with sample fallback data
  const [skillTrends, setSkillTrends] = useState(sampleSkillTrends);
  const [topSkills, setTopSkills] = useState(sampleTopSkills);
  const [filteredSkills, setFilteredSkills] = useState(sampleTopSkills);
  const [locationDemand, setLocationDemand] = useState(sampleLocationDemand);
  const [industryDistribution, setIndustryDistribution] = useState(
    sampleIndustryDistribution
  );

  // Loading states
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingIndustries, setLoadingIndustries] = useState(false);

  // Error states
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch data when component mounts or filters change
  useEffect(() => {
    fetchSkillTrends();
    fetchTopSkills();
  }, []);

  useEffect(() => {
    if (activeTab === "locations") {
      fetchLocationDemand();
    } else if (activeTab === "industries") {
      fetchIndustryDistribution();
    }
  }, [activeTab]);

  // Filter skills based on search term
  useEffect(() => {
    // Only filter skills when there's a search term
    if (searchTerm) {
      const filtered = topSkills.filter((skill) =>
        skill.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSkills(filtered);
    } else {
      // When search term is cleared, show all skills
      setFilteredSkills(topSkills);
    }
  }, [searchTerm, topSkills]);

  // Data fetching functions
  const fetchSkillTrends = async () => {
    setLoadingTrends(true);
    try {
      const response = await axios.get("/api/job-market", {
        params: {
          type: "trends",
          skill: searchTerm || selectedSkill, // Use search term if available
          location: selectedLocation,
        },
      });

      // Ensure data is properly formatted for recharts
      const trendsData = Array.isArray(response.data)
        ? response.data
        : sampleSkillTrends;
      setSkillTrends(trendsData);
      setErrorMessage("");
    } catch (error) {
      console.error("Error fetching skill trends:", error);
      setErrorMessage(
        "Failed to load skill trends data. Using sample data instead."
      );
      setSkillTrends(sampleSkillTrends); // Fallback to sample data
    } finally {
      setLoadingTrends(false);
    }
  };

  const fetchTopSkills = async () => {
    setLoadingSkills(true);
    try {
      const response = await axios.get("/api/job-market", {
        params: {
          type: "skills",
          location: selectedLocation,
          search: searchTerm, // Include search term in API request
        },
      });
      // Ensure data is an array with the right format
      const skillsData = Array.isArray(response.data)
        ? response.data
        : sampleTopSkills;
      setTopSkills(skillsData);
      // Apply search filter if term exists
      const filteredData = searchTerm
        ? skillsData.filter((skill) =>
            skill.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : skillsData;
      setFilteredSkills(filteredData);
      setErrorMessage("");
    } catch (error) {
      console.error("Error fetching top skills:", error);
      setTopSkills(sampleTopSkills); // Default to sample data on error
      setFilteredSkills(sampleTopSkills);
      setErrorMessage("Failed to load skills data. Using sample data instead.");
    } finally {
      setLoadingSkills(false);
    }
  };

  const fetchLocationDemand = async () => {
    setLoadingLocations(true);
    try {
      // Use your actual job recommendations API
      const response = await axios.get(
        "http://localhost:5000/job_recommendations_multi",
        {
          params: {
            skills: selectedSkill || "Python,JavaScript,React,AWS",
            location: selectedLocation !== "all" ? selectedLocation : undefined,
            search: searchTerm, // Include search term for filtering locations
          },
        }
      );

      // Transform the API response to match your chart format
      const skillData =
        response.data[selectedSkill] ||
        response.data[Object.keys(response.data)[0]] ||
        [];
      const formattedData = skillData.map((item) => ({
        name: item.city,
        jobs: item.job_count,
        averageSalary: item.average_salary || 0,
      }));

      // Filter locations if search term exists
      const filteredData = searchTerm
        ? formattedData.filter((location) =>
            location.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : formattedData;

      setLocationDemand(filteredData);
      setErrorMessage("");
    } catch (error) {
      console.error("Error fetching location demand:", error);
      setLocationDemand(sampleLocationDemand);
      setErrorMessage(
        "Failed to load location data. Using sample data instead."
      );
    } finally {
      setLoadingLocations(false);
    }
  };

  const fetchIndustryDistribution = async () => {
    setLoadingIndustries(true);
    try {
      const response = await axios.get("/api/job-market", {
        params: {
          type: "industries",
          location: selectedLocation,
          search: searchTerm, // Include search term for filtering industries
        },
      });
      const industriesData = Array.isArray(response.data)
        ? response.data
        : sampleIndustryDistribution;

      // Filter industries if search term exists
      const filteredData = searchTerm
        ? industriesData.filter((industry) =>
            industry.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : industriesData;

      setIndustryDistribution(filteredData);
      setErrorMessage("");
    } catch (error) {
      console.error("Error fetching industry distribution:", error);
      setIndustryDistribution(sampleIndustryDistribution); // Fallback to sample data
      setErrorMessage(
        "Failed to load industry data. Using sample data instead."
      );
    } finally {
      setLoadingIndustries(false);
    }
  };

  const handleApplyFilters = () => {
    // Market Trends: Filter by location and search term for skill trends
    if (activeTab === "trends") {
      fetchSkillTrends(); // Will use selectedLocation and searchTerm
    }

    // In-Demand Skills: Filter by location and search term
    if (activeTab === "skills") {
      fetchTopSkills(); // Will use selectedLocation
      if (searchTerm) {
        setFilteredSkills(
          topSkills.filter((skill) =>
            skill.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
        );
      }
    }

    // Location Analysis: Filter by selected skill and location
    if (activeTab === "locations") {
      fetchLocationDemand(); // Will use selectedSkill and selectedLocation
    }

    // Industry Breakdown: Filter by location and search term for industry focus
    if (activeTab === "industries") {
      fetchIndustryDistribution(); // Will use selectedLocation and searchTerm
    }
  };

  const handleTabChange = (value) => {
    console.log("Tab changed to:", value);
    setActiveTab(value);
  };

  // Loading component
  const LoadingSpinner = () => (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="h-8 w-8 sm:h-10 sm:w-10 text-primary animate-spin" />
      <span className="text-sm sm:text-base text-gray-600">
        Loading data...
      </span>
    </div>
  );

  // Error component
  const ErrorMessage = ({ message }) => (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm sm:text-base flex items-center justify-center">
      <p className="text-center">{message}</p>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="page-header text-2xl sm:text-3xl md:text-4xl font-bold mb-6">
          Job Market Analysis
        </h1>

        {errorMessage && <ErrorMessage message={errorMessage} />}

        <div className="mb-8 space-y-6">
          <div className="relative w-full">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              size={18}
            />
            <Input
              placeholder="Search skills, locations, or industries..."
              className="pl-10 w-full text-sm sm:text-base"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full sm:items-center">
            <div className="w-full sm:w-48">
              <Select
                value={selectedLocation}
                onValueChange={setSelectedLocation}
              >
                <SelectTrigger className="w-full text-sm sm:text-base">
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  <SelectItem value="us">United States</SelectItem>
                  <SelectItem value="europe">Europe</SelectItem>
                  <SelectItem value="asia">Asia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="bg-primary w-full sm:w-auto text-sm sm:text-base flex items-center justify-center gap-2 min-h-[40px] rounded-lg transition-all duration-200 hover:opacity-90 focus:ring-2 focus:ring-primary/50"
              onClick={handleApplyFilters}
              disabled={
                loadingTrends ||
                loadingSkills ||
                loadingLocations ||
                loadingIndustries
              }
            >
              {loadingTrends ||
              loadingSkills ||
              loadingLocations ||
              loadingIndustries ? (
                <>
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>Apply Filters</span>
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs
          defaultValue="trends"
          className="space-y-8"
          onValueChange={handleTabChange}
        >
          <div className="w-full overflow-x-auto">
            <TabsList className="w-full min-w-fit grid grid-cols-4 sm:flex sm:flex-row gap-1 p-1 bg-muted/20 rounded-xl h-auto">
              <TabsTrigger
                value="trends"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg transition-all duration-200 hover:bg-muted/50 min-w-0 flex-1"
              >
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center sm:text-left">
                  <span className="block sm:hidden">Trends</span>
                  <span className="hidden sm:block">Market Trends</span>
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="skills"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg transition-all duration-200 hover:bg-muted/50 min-w-0 flex-1"
              >
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center sm:text-left">
                  <span className="block sm:hidden">Skills</span>
                  <span className="hidden sm:block">In-Demand Skills</span>
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="locations"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg transition-all duration-200 hover:bg-muted/50 min-w-0 flex-1"
              >
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center sm:text-left">
                  <span className="block sm:hidden">Locations</span>
                  <span className="hidden sm:block">Location Analysis</span>
                </span>
              </TabsTrigger>

              <TabsTrigger
                value="industries"
                className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg transition-all duration-200 hover:bg-muted/50 min-w-0 flex-1"
              >
                <Building className="h-3 w-3 sm:h-4 sm:w-4 shrink-0" />
                <span className="text-[10px] sm:text-xs md:text-sm leading-tight text-center sm:text-left">
                  <span className="block sm:hidden">Industries</span>
                  <span className="hidden sm:block">Industry Breakdown</span>
                </span>
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Skill Demand Trends (Last 12 Months)
                </CardTitle>
                <CardDescription>
                  Track how demand for key tech skills has changed over the past
                  year.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTrends ? (
                  <LoadingSpinner />
                ) : skillTrends &&
                  Array.isArray(skillTrends) &&
                  skillTrends.length > 0 ? (
                  <>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={skillTrends}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          {/* Only render each Area if the data has this property */}
                          {skillTrends[0]?.JavaScript !== undefined && (
                            <Area
                              type="monotone"
                              dataKey="JavaScript"
                              stackId="1"
                              stroke="#6366F1"
                              fill="#6366F1"
                            />
                          )}
                          {skillTrends[0]?.Python !== undefined && (
                            <Area
                              type="monotone"
                              dataKey="Python"
                              stackId="2"
                              stroke="#8B5CF6"
                              fill="#8B5CF6"
                            />
                          )}
                          {skillTrends[0]?.React !== undefined && (
                            <Area
                              type="monotone"
                              dataKey="React"
                              stackId="3"
                              stroke="#A78BFA"
                              fill="#A78BFA"
                            />
                          )}
                          {skillTrends[0]?.AWS !== undefined && (
                            <Area
                              type="monotone"
                              dataKey="AWS"
                              stackId="4"
                              stroke="#C4B5FD"
                              fill="#C4B5FD"
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 justify-center">
                      {skillTrends[0]?.JavaScript !== undefined && (
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-[#6366F1] mr-1 rounded-sm"></div>
                          <span className="text-sm">JavaScript</span>
                        </div>
                      )}
                      {skillTrends[0]?.Python !== undefined && (
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-[#8B5CF6] mr-1 rounded-sm"></div>
                          <span className="text-sm">Python</span>
                        </div>
                      )}
                      {skillTrends[0]?.React !== undefined && (
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-[#A78BFA] mr-1 rounded-sm"></div>
                          <span className="text-sm">React</span>
                        </div>
                      )}
                      {skillTrends[0]?.AWS !== undefined && (
                        <div className="flex items-center">
                          <div className="w-3 h-3 bg-[#C4B5FD] mr-1 rounded-sm"></div>
                          <span className="text-sm">AWS</span>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    No trend data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="skills">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Top In-Demand Skills
                </CardTitle>
                <CardDescription className="text-sm">
                  The most sought-after technical skills by employers right now.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-6">
                {loadingSkills ? (
                  <LoadingSpinner />
                ) : filteredSkills &&
                  Array.isArray(filteredSkills) &&
                  filteredSkills.length > 0 ? (
                  <>
                    <div className="h-[300px] sm:h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={filteredSkills}
                          layout="vertical"
                          margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            type="number"
                            domain={[0, 100]}
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fontSize: 12 }}
                            width={100}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="value"
                            fill="#6366F1"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 sm:p-8 text-gray-500">
                    No skills data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <MapPin className="h-5 w-5 text-primary" />
                  Job Opportunities by Location
                </CardTitle>
                <CardDescription className="text-sm">
                  Cities with the highest number of tech job openings for{" "}
                  {selectedSkill}.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-6">
                {loadingLocations ? (
                  <LoadingSpinner />
                ) : locationDemand &&
                  Array.isArray(locationDemand) &&
                  locationDemand.length > 0 ? (
                  <>
                    <div className="h-[300px] sm:h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={locationDemand}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis
                            dataKey="name"
                            type="category"
                            tick={{ fontSize: 12 }}
                            width={100}
                          />
                          <Tooltip />
                          <Bar
                            dataKey="jobs"
                            fill="#6366F1"
                            radius={[0, 4, 4, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 sm:p-8 text-gray-500">
                    No location data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="industries">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Building className="h-5 w-5 text-primary" />
                  Industry Breakdown
                </CardTitle>
                <CardDescription className="text-sm">
                  Distribution of job opportunities across different industries.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-2 sm:p-6">
                {loadingIndustries ? (
                  <LoadingSpinner />
                ) : industryDistribution &&
                  Array.isArray(industryDistribution) &&
                  industryDistribution.length > 0 ? (
                  <>
                    <div className="h-[300px] sm:h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={industryDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={60} // Fixed value for mobile
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}%`}
                          >
                            {industryDistribution.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* For larger screens, you could create a separate component or use state */}
                    <div className="hidden sm:block h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={industryDistribution}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={100} // Larger value for desktop
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}%`}
                          >
                            {industryDistribution.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
                      {industryDistribution.map((industry, index) => (
                        <div key={industry.name} className="flex items-center">
                          <div
                            className="w-3 h-3 mr-1 rounded-sm"
                            style={{
                              backgroundColor: COLORS[index % COLORS.length],
                            }}
                          ></div>
                          <span>{industry.name}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center p-4 sm:p-8 text-gray-500">
                    No industry data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default JobMarket;
