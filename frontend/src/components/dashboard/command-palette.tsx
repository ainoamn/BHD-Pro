"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, FileText, BookOpen, Package, Users, BarChart3, Receipt, Brain, Settings, Crown, Shield, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const commands: CommandItem[] = [
    { id: "dashboard", title: "لوحة التحكم", description: "الذهاب إلى لوحة التحكم", icon: LayoutDashboard, action: () => router.push("/dashboard") },
    { id: "invoices", title: "فاتورة جديدة", description: "إنشاء فاتورة جديدة", icon: FileText, shortcut: "Ctrl+N", action: () => router.push("/accounting?action=new&type=SALES") },
    { id: "journal", title: "قيد جديد", description: "إنشاء قيد محاسبي", icon: BookOpen, shortcut: "Ctrl+J", action: () => router.push("/journal") },
    { id: "inventory", title: "المخزون", description: "إدارة المنتجات", icon: Package, action: () => router.push("/inventory") },
    { id: "contacts", title: "العملاء", description: "إدارة العملاء والموردين", icon: Users, action: () => router.push("/contacts") },
    { id: "reports", title: "التقارير", description: "التقارير المالية", icon: BarChart3, action: () => router.push("/reports") },
    { id: "vat", title: "الفوترة الإلكترونية", description: "ZATCA / FTA", icon: Receipt, action: () => router.push("/vat") },
    { id: "ai", title: "تحليلات AI", description: "التحليلات الذكية", icon: Brain, action: () => router.push("/ai-analytics") },
    { id: "settings", title: "الإعدادات", description: "إعدادات الشركة", icon: Settings, action: () => router.push("/settings") },
    { id: "subscription", title: "الاشتراك", description: "إدارة الاشتراك", icon: Crown, action: () => router.push("/subscription") },
    { id: "users", title: "المستخدمين", description: "إدارة الفريق", icon: Shield, action: () => router.push("/users") },
  ];

  const filtered = commands.filter(
    (cmd) =>
      cmd.title.includes(search) ||
      cmd.description.includes(search)
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
      if (e.key === "Escape") {
        setCommandPaletteOpen(false);
      }
      if (!commandPaletteOpen) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        filtered[selectedIndex]?.action();
        setCommandPaletteOpen(false);
      }
    },
    [commandPaletteOpen, filtered, selectedIndex, setCommandPaletteOpen]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center pt-32 bg-black/60 backdrop-blur-sm"
          onClick={() => setCommandPaletteOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-indigo-500/10 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
              <Search className="w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="اكتب أمراً أو ابحث..."
                className="flex-1 bg-transparent text-white placeholder:text-slate-500 focus:outline-none"
                autoFocus
              />
              <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-500 font-mono">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto py-2">
              {filtered.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-500">
                  لا توجد نتائج
                </div>
              ) : (
                filtered.map((cmd, index) => {
                  const Icon = cmd.icon;
                  const isSelected = index === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setCommandPaletteOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors",
                        isSelected
                          ? "bg-indigo-500/10 text-indigo-400"
                          : "text-slate-300 hover:bg-slate-800/50"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        isSelected ? "bg-indigo-500/20" : "bg-slate-800"
                      )}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 text-right">
                        <p className="text-sm font-medium">{cmd.title}</p>
                        <p className="text-xs text-slate-500">{cmd.description}</p>
                      </div>
                      {cmd.shortcut && (
                        <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-500 font-mono">
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
