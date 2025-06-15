import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Search, TrendingUp, MapPin, Building, BarChart3, PieChart as PieChartIcon, Loader2 } from 'lucide-react';
import axios from 'axios';

const COLORS = ['#6366F1', '#8B5CF6', '#A78BFA', '#C4B5FD', '#818CF8', '#93C5FD', '#BAE6FD', '#E0F2FE'];

// Sample data for development and fallback
const sampleSkillTrends = [
  { name: 'Jan', JavaScript: 65, Python: 45, React: 55, AWS: 35 },
  { name: 'Feb', JavaScript: 68, Python: 48, React: 58, AWS: 38 },
  { name: 'Mar', JavaScript: 70, Python: 52, React: 60, AWS: 40 },
  { name: 'Apr', JavaScript: 73, Python: 56, React: 62, AWS: 42 },
  { name: 'May', JavaScript: 75, Python: 60, React: 65, AWS: 45 },
  { name: 'Jun', JavaScript: 78, Python: 62, React: 68, AWS: 48 },
  { name: 'Jul', JavaScript: 80, Python: 65, React: 70, AWS: 50 },
  { name: 'Aug', JavaScript: 82, Python: 68, React: 72, AWS: 52 },
  { name: 'Sep', JavaScript: 85, Python: 70, React: 75, AWS: 55 },
  { name: 'Oct', JavaScript: 88, Python: 72, React: 78, AWS: 58 },
  { name: 'Nov', JavaScript: 90, Python: 75, React: 80, AWS: 60 },
  { name: 'Dec', JavaScript: 92, Python: 78, React: 82, AWS: 62 },
];

const sampleTopSkills = [
  { name: 'JavaScript', value: 92 },
  { name: 'Python', value: 78 },
  { name: 'React', value: 82 },
  { name: 'AWS', value: 62 },
  { name: 'TypeScript', value: 75 },
  { name: 'Node.js', value: 70 },
  { name: 'SQL', value: 65 },
  { name: 'Docker', value: 58 },
];

const sampleLocationDemand = [
  { name: 'San Francisco', jobs: 12500 },
  { name: 'New York', jobs: 11200 },
  { name: 'Seattle', jobs: 10800 },
  { name: 'Austin', jobs: 8900 },
  { name: 'Boston', jobs: 7600 },
  { name: 'Chicago', jobs: 6800 },
  { name: 'Los Angeles', jobs: 6200 },
  { name: 'Denver', jobs: 5500 },
];

const sampleIndustryDistribution = [
  { name: 'Technology', value: 35 },
  { name: 'Finance', value: 20 },
  { name: 'Healthcare', value: 15 },
  { name: 'Retail', value: 10 },
  { name: 'Education', value: 8 },
  { name: 'Manufacturing', value: 7 },
  { name: 'Government', value: 5 },
];

const JobMarket = () => {
  // State variables
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState('JavaScript');
  const [activeTab, setActiveTab] = useState('trends');
  
  // Data state with sample fallback data
  const [skillTrends, setSkillTrends] = useState(sampleSkillTrends);
  const [topSkills, setTopSkills] = useState(sampleTopSkills);
  const [filteredSkills, setFilteredSkills] = useState(sampleTopSkills);
  const [locationDemand, setLocationDemand] = useState(sampleLocationDemand);
  const [industryDistribution, setIndustryDistribution] = useState(sampleIndustryDistribution);
  
  // Loading states
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingIndustries, setLoadingIndustries] = useState(false);
  
  // Error states
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch data when component mounts or filters change
  useEffect(() => {
    fetchSkillTrends();
    fetchTopSkills();
  }, []);

  useEffect(() => {
    if (activeTab === 'locations') {
      fetchLocationDemand();
    } else if (activeTab === 'industries') {
      fetchIndustryDistribution();
    }
  }, [activeTab]);

  // Filter skills based on search term
  useEffect(() => {
    if (searchTerm && Array.isArray(topSkills)) {
      setFilteredSkills(topSkills.filter(skill => 
        skill.name.toLowerCase().includes(searchTerm.toLowerCase())
      ));
    } else {
      setFilteredSkills(topSkills);
    }
  }, [searchTerm, topSkills]);

  // Data fetching functions
  const fetchSkillTrends = async () => {
    setLoadingTrends(true);
    try {
      const response = await axios.get('/api/job-market', {
        params: { 
          type: 'trends',
          skill: selectedSkill 
        }
      });
      
      // Ensure data is properly formatted for recharts
      const trendsData = Array.isArray(response.data) ? response.data : sampleSkillTrends;
      setSkillTrends(trendsData);
      setErrorMessage('');
    } catch (error) {
      console.error('Error fetching skill trends:', error);
      setErrorMessage('Failed to load skill trends data. Using sample data instead.');
      setSkillTrends(sampleSkillTrends); // Fallback to sample data
    } finally {
      setLoadingTrends(false);
    }
  };

  const fetchTopSkills = async () => {
    setLoadingSkills(true);
    try {
      const response = await axios.get('/api/job-market', {
        params: { 
          type: 'skills',
          location: selectedLocation 
        }
      });
      // Ensure data is an array with the right format
      const skillsData = Array.isArray(response.data) ? response.data : sampleTopSkills;
      setTopSkills(skillsData);
      setFilteredSkills(skillsData);
      setErrorMessage('');
    } catch (error) {
      console.error('Error fetching top skills:', error);
      setTopSkills(sampleTopSkills); // Default to sample data on error
      setFilteredSkills(sampleTopSkills);
      setErrorMessage('Failed to load skills data. Using sample data instead.');
    } finally {
      setLoadingSkills(false);
    }
  };

  const fetchLocationDemand = async () => {
    setLoadingLocations(true);
    try {
      const response = await axios.get('/api/job-market', {
        params: { 
          type: 'locations',
          skill: selectedSkill 
        }
      });
      const locationsData = Array.isArray(response.data) ? response.data : sampleLocationDemand;
      setLocationDemand(locationsData);
      setErrorMessage('');
    } catch (error) {
      console.error('Error fetching location demand:', error);
      setLocationDemand(sampleLocationDemand); // Fallback to sample data
      setErrorMessage('Failed to load location data. Using sample data instead.');
    } finally {
      setLoadingLocations(false);
    }
  };

  const fetchIndustryDistribution = async () => {
    setLoadingIndustries(true);
    try {
      const response = await axios.get('/api/job-market', {
        params: { 
          type: 'industries',
          location: selectedLocation 
        }
      });
      const industriesData = Array.isArray(response.data) ? response.data : sampleIndustryDistribution;
      setIndustryDistribution(industriesData);
      setErrorMessage('');
    } catch (error) {
      console.error('Error fetching industry distribution:', error);
      setIndustryDistribution(sampleIndustryDistribution); // Fallback to sample data
      setErrorMessage('Failed to load industry data. Using sample data instead.');
    } finally {
      setLoadingIndustries(false);
    }
  };

  const handleApplyFilters = () => {
    fetchSkillTrends();
    fetchTopSkills();
    
    if (activeTab === 'locations') {
      fetchLocationDemand();
    } else if (activeTab === 'industries') {
      fetchIndustryDistribution();
    }
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
  };

  // Loading component
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-64">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <span className="ml-2">Loading data...</span>
    </div>
  );

  // Error component
  const ErrorMessage = ({ message }) => (
    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
      <p>{message}</p>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="page-header">Job Market Analysis</h1>
        
        {errorMessage && <ErrorMessage message={errorMessage} />}
        
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Search for a skill..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex gap-4">
            <div className="w-40">
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
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
              className="bg-primary"
              onClick={handleApplyFilters}
              disabled={loadingTrends || loadingSkills || loadingLocations || loadingIndustries}
            >
              {(loadingTrends || loadingSkills || loadingLocations || loadingIndustries) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Apply Filters'
              )}
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="trends" className="mb-6" onValueChange={handleTabChange}>
          <TabsList className="w-full mb-6">
            <TabsTrigger value="trends" className="flex-1">
              <TrendingUp className="mr-2 h-4 w-4" />
              Market Trends
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex-1">
              <BarChart3 className="mr-2 h-4 w-4" />
              In-Demand Skills
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex-1">
              <MapPin className="mr-2 h-4 w-4" />
              Location Analysis
            </TabsTrigger>
            <TabsTrigger value="industries" className="flex-1">
              <Building className="mr-2 h-4 w-4" />
              Industry Breakdown
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Skill Demand Trends (Last 12 Months)
                </CardTitle>
                <CardDescription>
                  Track how demand for key tech skills has changed over the past year.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTrends ? (
                  <LoadingSpinner />
                ) : skillTrends && Array.isArray(skillTrends) && skillTrends.length > 0 ? (
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
                            <Area type="monotone" dataKey="JavaScript" stackId="1" stroke="#6366F1" fill="#6366F1" />
                          )}
                          {skillTrends[0]?.Python !== undefined && (
                            <Area type="monotone" dataKey="Python" stackId="2" stroke="#8B5CF6" fill="#8B5CF6" />
                          )}
                          {skillTrends[0]?.React !== undefined && (
                            <Area type="monotone" dataKey="React" stackId="3" stroke="#A78BFA" fill="#A78BFA" />
                          )}
                          {skillTrends[0]?.AWS !== undefined && (
                            <Area type="monotone" dataKey="AWS" stackId="4" stroke="#C4B5FD" fill="#C4B5FD" />
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
                  <div className="text-center p-8 text-gray-500">No trend data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="skills">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Top In-Demand Skills
                </CardTitle>
                <CardDescription>
                  The most sought-after technical skills by employers right now.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSkills ? (
                  <LoadingSpinner />
                ) : filteredSkills && Array.isArray(filteredSkills) && filteredSkills.length > 0 ? (
                  <>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={filteredSkills}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" domain={[0, 100]} />
                          <YAxis dataKey="name" type="category" />
                          <Tooltip />
                          <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="mt-6">
                      <Label>Select skill to view detailed trends</Label>
                      <Select value={selectedSkill} onValueChange={setSelectedSkill}>
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="Select Skill" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(topSkills) && topSkills.map(skill => (
                            <SelectItem key={skill.name} value={skill.name}>{skill.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8 text-gray-500">No skills data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="locations">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Job Opportunities by Location
                </CardTitle>
                <CardDescription>
                  Cities with the highest number of tech job openings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLocations ? (
                  <LoadingSpinner />
                ) : locationDemand && Array.isArray(locationDemand) && locationDemand.length > 0 ? (
                  <>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={locationDemand}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="jobs" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gray-50 p-3 rounded-md text-center">
                        <div className="text-lg font-bold text-primary">$120K</div>
                        <div className="text-sm text-gray-600">Avg. Salary in SF</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md text-center">
                        <div className="text-lg font-bold text-primary">$115K</div>
                        <div className="text-sm text-gray-600">Avg. Salary in NYC</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md text-center">
                        <div className="text-lg font-bold text-primary">$110K</div>
                        <div className="text-sm text-gray-600">Avg. Salary in Seattle</div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md text-center">
                        <div className="text-lg font-bold text-primary">$105K</div>
                        <div className="text-sm text-gray-600">Avg. Salary in Austin</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-8 text-gray-500">No location data available</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="industries">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-primary" />
                  Industry Distribution of Tech Jobs
                </CardTitle>
                <CardDescription>
                  How tech jobs are distributed across different industries.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingIndustries ? (
                  <LoadingSpinner />
                ) : industryDistribution && Array.isArray(industryDistribution) && industryDistribution.length > 0 ? (
                  <div className="flex flex-col md:flex-row">
                    <div className="h-[350px] w-full md:w-1/2">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={industryDistribution}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            fill="#8884d8"
                            paddingAngle={2}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {industryDistribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    
                    <div className="md:w-1/2 p-4">
                      <h3 className="text-lg font-semibold mb-4">Industry Insights</h3>
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-3 rounded-md">
                          <h4 className="font-medium text-primary">Technology</h4>
                          <p className="text-sm text-gray-600">Pure tech companies remain the largest employers of tech talent, offering competitive salaries and advancement opportunities.</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <h4 className="font-medium text-primary">Finance</h4>
                          <p className="text-sm text-gray-600">Financial institutions are rapidly expanding their tech teams as digital transformation accelerates in banking and investment services.</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-md">
                          <h4 className="font-medium text-primary">Healthcare</h4>
                          <p className="text-sm text-gray-600">The healthcare industry shows strong growth in tech hiring, particularly in telehealth, data analytics, and medical software development.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-500">No industry data available</div>
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