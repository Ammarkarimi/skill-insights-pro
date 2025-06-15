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
      <div className="max-w-5xl mx-auto">
        <h1 className="page-header">Personalized Path Recommendation</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                Your Skills Profile
              </CardTitle>
              <CardDescription>
                Rate your proficiency in different skills to get personalized recommendations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex gap-2 mb-4">
                  <Input
                    placeholder="Add a new skill (e.g., Python, Docker, AWS)"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    className="flex-grow"
                  />
                  <Button onClick={handleAddSkill}>Add</Button>
                </div>
                
                <div className="space-y-5">
                  {skills.map((skill, index) => (
                    <div key={index}>
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">{skill.name}</span>
                        <span className="text-sm text-gray-500">{skill.proficiency}%</span>
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
                    Generating Recommendations...
                  </>
                ) : (
                  'Generate Path Recommendations'
                )}
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" />
                Your Profile Strength
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium">Profile Completeness</span>
                  <span className="text-sm font-medium">75%</span>
                </div>
                <Progress value={75} className="h-2" />
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Skills Added</p>
                    <p className="text-sm text-gray-500">You've added {skills.length} skills</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Proficiency Rated</p>
                    <p className="text-sm text-gray-500">You've rated all your skills</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2 opacity-50">
                  <div className="h-5 w-5 border-2 border-gray-300 rounded-full mt-0.5"></div>
                  <div>
                    <p className="font-medium">Career Goals</p>
                    <p className="text-sm text-gray-500">Add your career objectives</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-2 opacity-50">
                  <div className="h-5 w-5 border-2 border-gray-300 rounded-full mt-0.5"></div>
                  <div>
                    <p className="font-medium">Learning Preferences</p>
                    <p className="text-sm text-gray-500">Set your learning style</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="paths" className="mb-8">
          <TabsList className="w-full mb-6">
            <TabsTrigger value="paths" className="flex-1">
              <Briefcase className="mr-2 h-4 w-4" />
              Recommended Paths
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex-1">
              <BookOpen className="mr-2 h-4 w-4" />
              Learning Resources
            </TabsTrigger>
            <TabsTrigger value="skills" className="flex-1">
              <Code className="mr-2 h-4 w-4" />
              Skills to Develop
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="paths">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recommendations.careerPaths.length > 0 ? (
                recommendations.careerPaths.map((path, index) => (
                  <Card key={index} className="flex flex-col h-full">
                    <CardHeader>
                      <CardTitle>{path.title}</CardTitle>
                      <CardDescription>{path.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 mb-2">Required Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {path.skills.map((skill, idx) => (
                              <Badge 
                                key={idx} 
                                variant={skills.some(s => s.name === skill) ? "default" : "outline"}
                                className={skills.some(s => s.name === skill) ? "bg-primary" : ""}
                              >
                                {skill}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Est. Timeline</h3>
                            <p>{path.timeline}</p>
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Avg. Salary</h3>
                            <p>{path.avgSalary}</p>
                          </div>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Growth Outlook</h3>
                          <p>{path.growthRate}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Skill Match</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress 
                              value={
                                (path.skills.filter(skill => 
                                  skills.some(s => s.name === skill)
                                ).length / path.skills.length) * 100
                              } 
                              className="h-2 flex-grow" 
                            />
                            <span className="text-sm">
                              {Math.round((path.skills.filter(skill => 
                                skills.some(s => s.name === skill)
                              ).length / path.skills.length) * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full">
                        View Detailed Roadmap
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <Card className="col-span-2">
                  <CardContent className="pt-6 text-center">
                    <p className="text-gray-500">
                      Generate recommendations to see career paths that match your skills.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="resources">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recommendations.learningResources.length > 0 ? (
                recommendations.learningResources.map((resource, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex justify-between">
                        <div>
                          <CardTitle>{resource.title}</CardTitle>
                          <CardDescription>{resource.provider}</CardDescription>
                        </div>
                        <Badge className={
                          resource.difficulty === 'Beginner' 
                            ? 'bg-green-500' 
                            : resource.difficulty === 'Intermediate' 
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }>
                          {resource.difficulty}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between mb-4">
                        <Badge variant="outline">{resource.type}</Badge>
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
                        Visit Resource
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <Card className="col-span-2">
                  <CardContent className="pt-6 text-center">
                    <p className="text-gray-500">
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
                  <CardTitle>Recommended Skills to Develop</CardTitle>
                  <CardDescription>
                    Based on your current profile and market trends, we recommend focusing on these skills.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="p-4 bg-primary/10 rounded-lg">
                      <h3 className="font-semibold mb-2">Most Valuable for Your Profile</h3>
                      <p className="text-sm text-gray-600 mb-4">
                        These skills will complement your existing strengths and open new opportunities.
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {recommendations.skillsToLearn
                          .filter(skill => skill.priority === "High")
                          .slice(0, 3)
                          .map((skill, idx) => (
                            <div key={idx} className="border rounded-md p-4">
                              <h4 className="font-medium">{skill.name}</h4>
                              <p className="text-sm text-gray-500 mb-2">{skill.category} development</p>
                              <div className="flex items-center text-sm">
                                <span className="text-green-600 font-medium">High demand</span>
                                <Separator orientation="vertical" className="mx-2 h-4" />
                                <span>+30% jobs</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold mb-3">Frontend Skills</h3>
                        <ul className="space-y-3">
                          {recommendations.skillsToLearn
                            .filter(skill => skill.category === "Frontend")
                            .map((skill, idx) => (
                              <li key={idx} className="flex items-center justify-between border-b pb-2">
                                <div>
                                  <span className="font-medium">{skill.name}</span>
                                  <p className="text-sm text-gray-500">Frontend development</p>
                                </div>
                                <Badge variant={skill.priority === "High" ? "default" : "outline"}>
                                  {skill.priority} Priority
                                </Badge>
                              </li>
                            ))}
                        </ul>
                      </div>
                      
                      <div>
                        <h3 className="font-semibold mb-3">Backend Skills</h3>
                        <ul className="space-y-3">
                          {recommendations.skillsToLearn
                            .filter(skill => skill.category === "Backend")
                            .map((skill, idx) => (
                              <li key={idx} className="flex items-center justify-between border-b pb-2">
                                <div>
                                  <span className="font-medium">{skill.name}</span>
                                  <p className="text-sm text-gray-500">Backend development</p>
                                </div>
                                <Badge variant={skill.priority === "High" ? "default" : "outline"}>
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
                  <p className="text-gray-500">
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