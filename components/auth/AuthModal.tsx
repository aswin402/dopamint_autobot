"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  X,
  Mail,
  Lock,
  User as UserIcon,
  Sparkles,
  ArrowRight,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { EASE_OUT, SPRING_SWAP, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login, register } = useAuth();
  const reduce = useReducedMotion() ?? false;

  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        const res = await login(email, password);
        if (!res.success) {
          setError(res.error || "Invalid credentials");
        }
      } else {
        if (!name.trim()) {
          setError("Name is required");
          setIsSubmitting(false);
          return;
        }
        const res = await register(name, email, password);
        if (!res.success) {
          setError(res.error || "Failed to create account");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={closeAuthModal}
        className="fixed inset-0 bg-background/80 backdrop-blur-md cursor-pointer"
      />

      {/* Modal Dialog */}
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={SPRING_SWAP}
        className="relative w-full max-w-md bg-card border border-border rounded-[28px] shadow-2xl p-6 z-10 overflow-hidden"
      >
        {/* Close button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto mb-2 shadow-xs">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {mode === "login"
              ? "Access your saved attendee rosters, automations, and live sessions."
              : "Set up your autonomous form operations profile in seconds."}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-muted/60 p-1 mb-5 border border-border/60">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              mode === "login"
                ? "bg-card text-foreground shadow-2xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={cn(
              "flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
              mode === "register"
                ? "bg-card text-foreground shadow-2xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground block">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Morgan"
                  required
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground block">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                required
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground block">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-10 rounded-xl text-xs font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90 mt-2 cursor-pointer shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{mode === "login" ? "Signing In..." : "Creating Account..."}</span>
              </>
            ) : (
              <>
                <span>{mode === "login" ? "Sign In" : "Register"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-5 text-center">
          <p className="text-[11px] text-muted-foreground">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Create one here
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Sign in here
                </button>
              </>
            )}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
