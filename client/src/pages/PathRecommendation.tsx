import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { GraduationCap, BookOpen, Award, Code, Briefcase, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

interface Skill {
  name: string;
  proficiency: number;
}

interface LearningResource {
  title: string;
  type: string;
  provider: string;
  difficulty: string;
  url: string;
  rating: number;
}

interface CareerPath {
  title: string;
  description: string;
  skills: string[];
  timeline: string;
  avgSalary: string;
  growthRate: string;
}

interface SkillToLearn {
  name: string;
  priority: string;
  category: string;
}

const PathRecommendation: React.FC = () => {
  const [skills, setSkills] = useState<Skill[]>([
    { name: 'JavaScript', proficiency: 75 },
    { name: 'React', proficiency: 65 },
    { name: 'HTML/CSS', proficiency: 85 },
    { name: 'Node.js', proficiency: 60 },
    { name: 'SQL', proficiency: 50 },
  ]);
  
  const [newSkill, setNewSkill] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // State to store recommendations from backend
  const [recommendations, setRecommendations] = useState<{
    careerPaths: CareerPath[];
    learningResources: LearningResource[];
    skillsToLearn: SkillToLearn[];
  }>({
    careerPaths: [],
    learningResources: [],
    skillsToLearn: []
  });
  
  const handleAddSkill = () => {
    if (newSkill && !skills.some(s => s.name.toLowerCase() === newSkill.toLowerCase())) {
      setSkills([...skills, { name: newSkill, proficiency: 50 }]);
      setNewSkill('');
    }
  };
  
  const handleUpdateProficiency = (index: number, value: number) => {
    const updatedSkills = [...skills];
    updatedSkills[index].proficiency = value;
    setSkills(updatedSkills);
  };
  
  const handleGenerateRecommendations = () => {
    setIsLoading(true);
    
    // Send skills data to backend
    fetch('http://localhost:5000/generate_path_recommendations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ skills }),
    })
      .then(response => response.json())
      .then(data => {
        console.log('Recommendations received:', data);
        
        // Update state with received recommendations
        setRecommendations({
          careerPaths: data.careerPaths || [],
          learningResources: data.learningResources || [],
          skillsToLearn: data.skillsToLearn || []
        });
        
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Error:', error);
        setIsLoading(false);
      });
  };

  return (
     <Layout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6">Personalized Path Recommendation</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Your Skills Profile
              </CardTitle>
              <CardDescription className="text-sm">
                Rate your proficiency in different skills to get personalized recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <Input
                    placeholder="Add a new skill (e.g., Python, Docker, AWS)"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    className="flex-grow"
                  />
                  <Button onClick={handleAddSkill} className="w-full sm:w-auto px-8">
                    <span className="hidden sm:inline">Add Skill</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </div>
                
                <div className="space-y-5">
                  {skills.map((skill, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between mb-2">
                        <span className="font-medium text-sm sm:text-base">{skill.name}</span>
                        <span className="text-xs sm:text-sm text-gray-500">{skill.proficiency}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={skill.proficiency}
                          onChange={(e) => handleUpdateProficiency(index, parseInt(e.target.value))}
                          className="w-full accent-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full"
                onClick={handleGenerateRecommendations}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="hidden sm:inline">Generating Recommendations...</span>
                    <span className="sm:hidden">Generating...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Generate Path Recommendations</span>
                    <span className="sm:hidden">Generate</span>
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Your Profile Strength
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex justify-between mb-2">
                  <span className="text-sm sm:text-base font-medium">Profile Completeness</span>
                  <span className="text-sm sm:text-base font-medium">75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-start gap-2 bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">Skills Added</p>
                    <p className="text-xs sm:text-sm text-gray-500">You've added {skills.length} skills</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2 bg-green-50 p-2 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm sm:text-base">Proficiency Rated</p>
                    <p className="text-xs sm:text-sm text-gray-500">You've rated all your skills</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                  <div className="h-5 w-5 border-2 border-gray-300 rounded-full mt-0.5"></div>
                  <div>
                    <p className="font-medium text-sm sm:text-base">Career Goals</p>
                    <p className="text-xs sm:text-sm text-gray-500">Add your career objectives</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                  <div className="h-5 w-5 border-2 border-gray-300 rounded-full mt-0.5"></div>
                  <div>
                    <p className="font-medium text-sm sm:text-base">Learning Preferences</p>
                    <p className="text-xs sm:text-sm text-gray-500">Set your learning style</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="paths" className="mb-8">
          <TabsList className="grid grid-cols-3 gap-2 sm:gap-4 w-full mb-6">
            <TabsTrigger value="paths" className="flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Recommended Paths</span>
              <span className="sm:hidden">Paths</span>
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Learning Resources</span>
              <span className="sm:hidden">Resources</span>
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex items-center justify-center gap-1 sm:gap-2 p-2 sm:p-3">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Skills to Develop</span>
              <span className="sm:hidden">Skills</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="paths">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {recommendations.careerPaths.length > 0 ? (
                recommendations.careerPaths.map((path, index) => (
                  <Card key={index} className="flex flex-col h-full">
                    <CardHeader>
                      <CardTitle className="text-lg sm:text-xl">{path.title}</CardTitle>
                      <CardDescription className="text-sm">{path.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-2">Required Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {path.skills.map((skill, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs sm:text-sm">
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-1">Timeline</h3>
                            <p className="text-sm">{path.timeline}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-500 mb-1">Average Salary</h3>
                            <p className="text-sm">{path.avgSalary}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-1">Growth Outlook</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-green-600 text-sm">{path.growthRate}</span>
                            <span className="text-xs text-gray-500">projected growth</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="col-span-2">
                  <CardContent className="pt-6 text-center">
                    <p className="text-gray-500 text-sm sm:text-base">
                      Generate recommendations to see career paths tailored to your skills.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="resources">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {recommendations.learningResources.length > 0 ? (
                recommendations.learningResources.map((resource, index) => (
                  <Card key={index} className="flex flex-col h-full">
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <CardTitle className="text-lg sm:text-xl">{resource.title}</CardTitle>
                          <CardDescription className="text-sm">{resource.provider}</CardDescription>
                        </div>
                        <Badge className={`self-start sm:self-center ${resource.difficulty === 'Beginner' ? 'bg-green-500' : resource.difficulty === 'Intermediate' ? 'bg-amber-500' : 'bg-red-500'}`}>
                          {resource.difficulty}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <div className="flex flex-col sm:flex-row justify-between gap-2 sm:items-center mb-4">
                        <Badge variant="outline" className="text-xs sm:text-sm self-start">{resource.type}</Badge>
                        <div className="flex items-center">
                          <span className="text-amber-500 mr-1">★</span>
                          <span className="text-sm">{resource.rating}/5.0</span>
                        </div>
                      </div>
                      
                      <div className="mb-4">
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Why This Is Recommended</h3>
                        <p className="text-sm text-gray-600">
                          Based on your skills profile, this resource will help you advance to the next level.
                        </p>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full" variant="outline" onClick={() => window.open(resource.url, '_blank')}>
                        <span className="hidden sm:inline">Visit Resource</span>
                        <span className="sm:hidden">Visit</span>
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <Card className="col-span-2">
                  <CardContent className="pt-6 text-center">
                    <p className="text-gray-500 text-sm sm:text-base">
                      Generate recommendations to see learning resources tailored to your skills.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="skills">
            {recommendations.skillsToLearn.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg sm:text-xl">Recommended Skills to Develop</CardTitle>
                  <CardDescription className="text-sm">
                    Based on your current profile and market trends, we recommend focusing on these skills.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <h3 className="text-base sm:text-lg font-semibold mb-2">Most Valuable for Your Profile</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        These skills will complement your existing strengths and open new opportunities.
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recommendations.skillsToLearn
                          .filter(skill => skill.priority === "High")
                          .slice(0, 3)
                          .map((skill, idx) => (
                            <div key={idx} className="border rounded-md p-3 sm:p-4 bg-white">
                              <h4 className="font-medium text-base">{skill.name}</h4>
                              <p className="text-xs sm:text-sm text-gray-500 mb-2">{skill.category} development</p>
                              <div className="flex items-center text-xs sm:text-sm">
                                <span className="text-green-600 font-medium">High demand</span>
                                <Separator orientation="vertical" className="mx-2 h-4" />
                                <span>+30% jobs</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold mb-3">Frontend Skills</h3>
                        <ul className="space-y-3">
                          {recommendations.skillsToLearn
                            .filter(skill => skill.category === "Frontend")
                            .map((skill, idx) => (
                              <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                                <div>
                                  <span className="font-medium text-sm sm:text-base">{skill.name}</span>
                                  <p className="text-xs sm:text-sm text-gray-500">Frontend development</p>
                                </div>
                                <Badge variant={skill.priority === "High" ? "default" : "outline"} className="self-start sm:self-center">
                                  {skill.priority} Priority
                                </Badge>
                              </li>
                            ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold mb-3">Backend Skills</h3>
                        <ul className="space-y-3">
                          {recommendations.skillsToLearn
                            .filter(skill => skill.category === "Backend")
                            .map((skill, idx) => (
                              <li key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                                <div>
                                  <span className="font-medium text-sm sm:text-base">{skill.name}</span>
                                  <p className="text-xs sm:text-sm text-gray-500">Backend development</p>
                                </div>
                                <Badge variant={skill.priority === "High" ? "default" : "outline"} className="self-start sm:self-center">
                                  {skill.priority} Priority
                                </Badge>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-gray-500 text-sm sm:text-base">
                    Generate recommendations to see skills you should develop next.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default PathRecommendation;