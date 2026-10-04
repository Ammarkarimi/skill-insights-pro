import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Network, Users, TrendingUp, Globe, Linkedin, Mail, ExternalLink, Loader2, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Sample data for network stats (kept as dummy)
const connectionsByIndustry = [
  { name: 'Technology', value: 45 },
  { name: 'Finance', value: 20 },
  { name: 'Healthcare', value: 15 },
  { name: 'Education', value: 10 },
  { name: 'Other', value: 10 }
];

const connectionsByRole = [
  { name: 'Software Engineer', value: 35 },
  { name: 'Product Manager', value: 18 },
  { name: 'Designer', value: 15 },
  { name: 'Data Scientist', value: 12 },
  { name: 'Executive', value: 10 },
  { name: 'Other', value: 10 }
];

const reachStats = [
  { name: '1st', connections: 214 },
  { name: '2nd', connections: 1825 },
  { name: '3rd+', connections: 8760 }
];

const COLORS = ['#6366F1', '#8B5CF6', '#A78BFA', '#C4B5FD', '#818CF8', '#93C5FD'];

interface Connection {
  id: number;
  name: string;
  role: string;
  company: string;
  industry: string;
  mutualConnections: number;
  recentActivity: string;
  profileStrength: number;
}

interface UserProfile {
  email: string;
  email_verified: boolean;
  family_name: string;
  given_name: string;
  locale: {
    country: string;
    language: string;
  };
  name: string;
  picture: string;
  sub: string;
}

const NetworkAnalysis: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  
  // Sample connections data (kept as dummy)
  const sampleConnections: Connection[] = [
    {
      id: 1,
      name: 'Aarav Mehta',
      role: 'Senior Software Engineer',
      company: 'Infosys Limited',
      industry: 'Information Technology',
      mutualConnections: 18,
      recentActivity: '2 weeks ago',
      profileStrength: 85
    },
    {
      id: 2,
      name: 'Priya Sharma',
      role: 'Product Manager',
      company: 'Flipkart',
      industry: 'E-commerce',
      mutualConnections: 10,
      recentActivity: '1 month ago',
      profileStrength: 78
    },
    {
      id: 3,
      name: 'Rahul Verma',
      role: 'CTO',
      company: 'Zolve',
      industry: 'Fintech',
      mutualConnections: 25,
      recentActivity: '3 days ago',
      profileStrength: 95
    },
    {
      id: 4,
      name: 'Sneha Iyer',
      role: 'Frontend Developer',
      company: 'FreshToHome',
      industry: 'E-commerce',
      mutualConnections: 14,
      recentActivity: '1 week ago',
      profileStrength: 72
    },
    {
      id: 5,
      name: 'Karan Patel',
      role: 'Data Scientist',
      company: 'Fractal Analytics',
      industry: 'Analytics',
      mutualConnections: 9,
      recentActivity: '1 month ago',
      profileStrength: 82
    }
  ];
  
  
  // Check for existing profile data on component mount
  useEffect(() => {
    
    // This represents where you might get data from localStorage or context
    // For demo purposes, we'll set a mock profile based on the API response
    const mockProfile: UserProfile = {
      email: "sachdenitesh@gmail.com",
      email_verified: true,
      family_name: "Sachde",
      given_name: "Nitesh",
      locale: {
        country: "US",
        language: "en"
      },
      name: "Nitesh Sachde",
      picture: "https://media.licdn.com/dms/image/v2/D5603AQE-fUHbdmcuVw/profile-displayphoto-shrink_100_100/profile-displayphoto-shrink_100_100/0/1679559371371?e=1750291200&v=beta&t=rGGIVsA0mWUrAgZbXJr6pY4oBOTT2erktwRKRSx1H6s",
      sub: "WPxgF_p0GK"
    };
    
    // Check if we have profile data and set connected state
    if (mockProfile) {
      setUserProfile(mockProfile);
      setIsConnected(true);
    }
  }, []);
  
  const [recommendations] = useState<Connection[]>(sampleConnections);
  
  const filteredRecommendations = recommendations.filter(connection => 
    connection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    connection.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
    connection.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    connection.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const handleConnectLinkedIn = async () => {
    setIsLoading(true);
  
    try {
      const res = await fetch('http://localhost:5000/linkedin/login');
      const data = await res.json();
      window.location.href = data.auth_url;
    } catch (error) {
      console.error("Error connecting to LinkedIn:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to LinkedIn. Please try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };
  
  const handleDisconnect = () => {
    setIsConnected(false);
    setUserProfile(null);
    
    toast({
      title: "LinkedIn Disconnected",
      description: "Your LinkedIn profile has been disconnected.",
    });
  };
  
  const handleContactRecommendation = (name: string) => {
    toast({
      title: "Recommendation Saved",
      description: `You've saved ${name} to your contacts list.`,
    });
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <h1 className="page-header">Network Analysis</h1>
        
        {!isConnected ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Linkedin className="h-5 w-5 text-primary" />
                Connect Your LinkedIn Profile
              </CardTitle>
              <CardDescription>
                Link your LinkedIn account to analyze your professional network and get personalized recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8">
                <div className="mb-6 text-center">
                  <Linkedin className="h-16 w-16 text-[#0077B5] mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Unlock Network Insights</h3>
                  <p className="text-gray-600 max-w-md">
                    Connect your LinkedIn profile to visualize your network, identify key connections, and discover new opportunities.
                  </p>
                </div>
                
                <Button 
                  size="lg" 
                  className="gap-2"
                  onClick={handleConnectLinkedIn}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Linkedin className="h-5 w-5" />
                      Connect with LinkedIn
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border">
                  <AvatarImage src={userProfile?.picture} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {userProfile?.given_name?.[0]}{userProfile?.family_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-semibold">{userProfile?.name}</h2>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-500">Connected</Badge>
                    <span className="text-sm text-gray-500">{userProfile?.email}</span>
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect}>
                Disconnect Account
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Network Size
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center">
                    <div className="text-5xl font-bold mb-2">214</div>
                    <p className="text-gray-500">Direct Connections</p>
                  </div>
                  
                  <div className="mt-6">
                    <div className="text-sm font-medium flex justify-between mb-1">
                      <span>Extended Reach</span>
                      <span>10,799 professionals</span>
                    </div>
                    <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
                      <div className="flex h-full">
                        <div className="bg-primary h-full" style={{ width: '16.7%' }}></div>
                        <div className="bg-purple-400 h-full" style={{ width: '16.9%' }}></div>
                        <div className="bg-indigo-300 h-full" style={{ width: '66.4%' }}></div>
                      </div>
                    </div>
                    
                    <div className="flex mt-2 text-xs justify-between">
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-primary mr-1"></div>
                        <span>1st (214)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-purple-400 mr-1"></div>
                        <span>2nd (1,825)</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-indigo-300 mr-1"></div>
                        <span>3rd+ (8,760)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-primary" />
                    Industry Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={connectionsByIndustry}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {connectionsByIndustry.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
                    {connectionsByIndustry.map((entry, index) => (
                      <div key={index} className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-1"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <span className="truncate">{entry.name}: {entry.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Network Growth
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center mb-6">
                    <div className="text-3xl font-bold text-green-500">+18%</div>
                    <p className="text-gray-500 text-sm">Growth in the past 6 months</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <div className="text-sm font-medium flex justify-between mb-1">
                        <span>New Connections</span>
                        <span className="text-green-500">+32</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium flex justify-between mb-1">
                        <span>Engagement Rate</span>
                        <span className="text-amber-500">+5%</span>
                      </div>
                      <Progress value={45} className="h-2" />
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium flex justify-between mb-1">
                        <span>Profile Views</span>
                        <span className="text-green-500">+23%</span>
                      </div>
                      <Progress value={65} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <Tabs defaultValue="recommendations" className="mb-6">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="recommendations" className="flex-1">Connection Recommendations</TabsTrigger>
                <TabsTrigger value="analysis" className="flex-1">Detailed Analysis</TabsTrigger>
                <TabsTrigger value="profile" className="flex-1">LinkedIn Profile</TabsTrigger>
              </TabsList>
              
              <TabsContent value="recommendations">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle>Recommended Connections</CardTitle>
                        <CardDescription>People you may want to connect with based on your profile and industry.</CardDescription>
                      </div>
                      <div className="w-64">
                        <Input
                          placeholder="Search recommendations..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {filteredRecommendations.length > 0 ? (
                        filteredRecommendations.map((connection) => (
                          <div key={connection.id} className="border rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between">
                            <div className="mb-4 md:mb-0">
                              <h3 className="font-semibold text-lg">{connection.name}</h3>
                              <p className="text-gray-600">{connection.role} at {connection.company}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <Badge variant="outline">{connection.industry}</Badge>
                                <span className="text-sm text-gray-500">{connection.mutualConnections} mutual connections</span>
                                <span className="text-xs text-gray-400">Active {connection.recentActivity}</span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 md:flex-row">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="flex gap-1"
                                onClick={() => handleContactRecommendation(connection.name)}
                              >
                                <Users className="h-4 w-4" />
                                Save Contact
                              </Button>
                              <Button 
                                size="sm"
                                className="flex gap-1"
                              >
                                <Mail className="h-4 w-4" />
                                Message
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No recommendations match your search criteria.
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-between">
                    <Button variant="outline">
                      Refresh Recommendations
                    </Button>
                    <Button className="flex gap-2" onClick={() => window.open('https://www.linkedin.com', '_blank')}>
                      <Linkedin className="h-4 w-4" />
                      Go to LinkedIn
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
              
              <TabsContent value="analysis">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Connection by Role
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={connectionsByRole}
                            layout="vertical"
                            margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="name" />
                            <Tooltip />
                            <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Network className="h-5 w-5 text-primary" />
                        Network Reach
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={reachStats}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="connections" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h3 className="font-medium mb-2">What this means</h3>
                        <p className="text-sm text-gray-600">
                          Your network extends to over 10,000 professionals. This gives you significant reach within your industry.
                          Consider leveraging your 2nd-degree connections for introductions to potential employers or partners.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="md:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Network Optimization Opportunities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="flex items-start gap-4 p-4 border rounded-lg">
                          <div className="bg-amber-100 p-2 rounded-full">
                            <Users className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <h3 className="font-medium mb-1">Diversify Your Industry Connections</h3>
                            <p className="text-sm text-gray-600">
                              45% of your connections are in Technology. Consider expanding into related fields like Finance (FinTech) or Healthcare (HealthTech) to broaden your opportunities.
                            </p>
                            <Button variant="link" className="p-0 h-auto text-primary">View strategy →</Button>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-4 p-4 border rounded-lg">
                          <div className="bg-blue-100 p-2 rounded-full">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-medium mb-1">Strengthen Key Relationships</h3>
                            <p className="text-sm text-gray-600">
                              You have 15 connections at companies you're interested in, but limited engagement. Increase meaningful interactions with these contacts.
                            </p>
                            <Button variant="link" className="p-0 h-auto text-primary">View strategy →</Button>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-4 p-4 border rounded-lg">
                          <div className="bg-green-100 p-2 rounded-full">
                            <Globe className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="font-medium mb-1">Target High-Value Connections</h3>
                            <p className="text-sm text-gray-600">
                              Based on your career goals, we've identified 25 potential connections who could significantly impact your career growth.
                            </p>
                            <Button variant="link" className="p-0 h-auto text-primary">View connections →</Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              
              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      LinkedIn Profile
                    </CardTitle>
                    <CardDescription>
                      Your connected LinkedIn profile information
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="flex-shrink-0">
                        <Avatar className="h-32 w-32 border-2 border-gray-200">
                          <AvatarImage src={userProfile?.picture} />
                          <AvatarFallback className="bg-primary text-white text-3xl">
                            {userProfile?.given_name?.[0]}{userProfile?.family_name?.[0]}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      
                      <div className="flex-grow space-y-6">
                        <div>
                          <h2 className="text-2xl font-bold">{userProfile?.name}</h2>
                          <p className="text-gray-600">Based in {userProfile?.locale?.country}</p>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                            <p>{userProfile?.name}</p>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Email</h3>
                            <p>{userProfile?.email}</p>
                            {userProfile?.email_verified && (
                              <Badge variant="outline" className="mt-1">Verified</Badge>
                            )}
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">First Name</h3>
                            <p>{userProfile?.given_name}</p>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Last Name</h3>
                            <p>{userProfile?.family_name}</p>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Country</h3>
                            <p>{userProfile?.locale?.country}</p>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Language</h3>
                            <p>{userProfile?.locale?.language.toUpperCase()}</p>
                          </div>
                          
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">LinkedIn ID</h3>
                            <p className="text-gray-500 text-sm">{userProfile?.sub}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-8 border-t pt-6">
                      <h3 className="font-medium mb-4">Additional Profile Information</h3>
                      <p className="text-gray-500 mb-4">
                        Your LinkedIn connection provides basic profile data. To access more detailed information like work history, education, and skills, please authorize the advanced LinkedIn API permissions.
                      </p>
                      <Button variant="outline">Request Extended Permissions</Button>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end">
                    <Button 
                      className="flex gap-2" 
                      onClick={() => window.open('https://www.linkedin.com/in/me', '_blank')}
                    >
                      <Linkedin className="h-4 w-4" />
                      View Full LinkedIn Profile
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </Layout>
  );
};

export default NetworkAnalysis;
