"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, X, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";

interface Message {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: Date;
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "ai",
    content: `مرحباً! أنا محاسبك الذكي. يمكنني مساعدتك في:
• تحليل أداء شركتك
• التنبؤ بالتدفق النقدي
• كشف الأنماط المشبوهة
• الإجابة على أسئلتك المحاسبية

كيف يمكنني مساعدتك اليوم؟`,
    timestamp: new Date(),
  },
];

const aiResponses: Record<string, string> = {
  إيرادات: "إجمالي إيراداتك هذا الشهر: 2,500 ر.ع. هذا أعلى بنسبة 12.5% من الشهر الماضي. الأداء ممتاز!",
  ربح: "صافي ربحك: 1,950 ر.ع. هامش الربح: 78%. يُنصح بخفض المصروفات التشغيلية 5%.",
  مخزون: "لديك 3 منتجات منخفضة: طابعة HP LaserJet (3 وحدات). يُنصح بإعادة الطلب.",
  ضريبة: "لديك 3 فواتير إلكترونية معتمدة من هيئة الضرائب العمانية (OTA). جميعها متوافقة.",
  توقع: "توقع AI: الإيرادات في الشهر القادم ستكون 2,680 ر.ع (+7.2%) بناءً على الاتجاه الحالي.",
  مساعدة: `أنا محاسبك الذكي! يمكنني:
• تحليل أداء شركتك
• التنبؤ بالإيرادات
• كشف الأنماط المشبوهة
• الإجابة على أسئلتك المحاسبية

جرب: "ما هي إيراداتي؟" أو "منتجات منخفضة"`,
  default: "شكراً لسؤالك! أنا أحلل بياناتك الآن...\n\nبناءً على آخر تحليل: أداء شركتك جيد هذا الشهر.",
};

export function AIChatWidget() {
  const { aiChatOpen, setAiChatOpen } = useUIStore();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    const currentInput = input;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    setTimeout(() => {
      const lowerInput = currentInput.toLowerCase();
      let response = aiResponses.default;

      for (const [key, value] of Object.entries(aiResponses)) {
        if (key !== "default" && lowerInput.includes(key)) {
          response = value;
          break;
        }
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1000 + Math.random() * 1000);
  };

  return (
    <>
      <AnimatePresence>
        {aiChatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-24 left-6 z-50 w-96 h-[500px] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-indigo-500/10 flex flex-col overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-b border-slate-800">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center animate-pulse">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">محاسب AI</p>
                <p className="text-xs text-slate-400">مساعدك المالي الذكي</p>
              </div>
              <button
                onClick={() => setAiChatOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("flex gap-2", message.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0",
                      message.role === "ai"
                        ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                        : "bg-slate-700"
                    )}
                  >
                    {message.role === "ai" ? (
                      <Bot className="w-4 h-4 text-white" />
                    ) : (
                      <User className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line",
                      message.role === "ai"
                        ? "bg-slate-800/80 text-slate-200 rounded-tl-none"
                        : "bg-indigo-500 text-white rounded-tr-none"
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="bg-slate-800/80 rounded-xl px-3 py-2 rounded-tl-none">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-slate-800">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="اسألني أي شيء عن حساباتك..."
                  className="flex-1 h-9 px-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleSend}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white hover:opacity-90 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setAiChatOpen(!aiChatOpen)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center"
      >
        <Sparkles className="w-6 h-6" />
        <div className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-20" />
      </motion.button>
    </>
  );
}
