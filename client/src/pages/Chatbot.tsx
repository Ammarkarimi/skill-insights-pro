import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, RotateCcw } from "lucide-react";
import Layout from "@/components/Layout";
import CostNote from "@/components/CostNote";
import { api, apiErrorMessage, isInsufficientCredits } from "@/lib/api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Message = {
  role: "assistant",
  content: "Hi! I'm your career assistant. Ask me about career paths, learning roadmaps, resumes, interviews or salary negotiation.",
};

const STARTERS = [
  "How do I switch from QA to software development?",
  "Give me a 3-month roadmap to become a data analyst",
  "How should I answer 'What is your expected salary?'",
  "Which projects make a junior frontend resume stand out?",
];

const Chatbot: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || isLoading) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setIsLoading(true);
    try {
      // Send recent context (excluding the canned greeting) so follow-up questions work.
      const history = next.slice(1).slice(-12);
      const { data } = await api.post<{ reply: string }>("/api/chat", { messages: history });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1));
      setInput(content);
      if (!isInsufficientCredits(err)) {
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${apiErrorMessage(err)}` }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <Card className="w-full max-w-3xl mx-auto flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-3rem)]">
        <CardHeader className="border-b py-4">
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              Career Assistant
            </span>
            <Button variant="ghost" size="sm" onClick={() => setMessages([GREETING])} disabled={isLoading} title="New conversation">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`px-4 py-2 rounded-lg max-w-[85%] text-sm ${
                  m.role === "user" ? "bg-primary text-primary-foreground whitespace-pre-wrap" : "bg-muted prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1"
                }`}
              >
                {m.role === "user" ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
              </div>
            </div>
          ))}
          {messages.length === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-4">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-left text-sm border rounded-lg p-3 hover:bg-gray-50">
                  {s}
                </button>
              ))}
            </div>
          )}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted px-4 py-2 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </CardContent>
        <CardFooter className="border-t pt-4 flex-col gap-2">
          <div className="flex w-full gap-2">
            <Textarea
              placeholder="Ask a career question… (Shift+Enter for a new line)"
              value={input}
              maxLength={4000}
              rows={2}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={isLoading}
              className="flex-1 resize-none"
            />
            <Button onClick={() => send()} disabled={isLoading || !input.trim()} className="self-end">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send message</span>
            </Button>
          </div>
          <CostNote action="chat_message" className="self-end" />
        </CardFooter>
      </Card>
    </Layout>
  );
};

export default Chatbot;
