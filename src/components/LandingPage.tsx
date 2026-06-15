import { useState, useEffect } from 'react';
import {
  Cpu, Database, Key, Layers, Brain, Terminal,
  ChevronRight, ArrowRight, Server, Network, Zap,
  CheckCircle2, Menu, X, Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingPageProps {
  onLaunch: () => void;
}

const NAV_ITEMS = [
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How It Works' },
];

const FEATURES = [
  {
    icon: Key,
    title: 'Sharded KV Store',
    desc: 'Consistent hashing distributes key-value pairs across nodes with automatic replication to the next healthy node.',
    color: 'from-emerald-400 to-teal-500',
    shadow: 'shadow-emerald-500/10',
  },
  {
    icon: Layers,
    title: 'Distributed File System',
    desc: 'Files are split into chunks and spread across your cluster for fault-tolerant storage with replica redundancy.',
    color: 'from-blue-400 to-indigo-500',
    shadow: 'shadow-blue-500/10',
  },
  {
    icon: Brain,
    title: 'Unified Vector Memory',
    desc: 'AI agent memories stored as 384-dim embeddings, queryable across all nodes in parallel with client-side merge.',
    color: 'from-purple-400 to-violet-500',
    shadow: 'shadow-purple-500/10',
  },
  {
    icon: Terminal,
    title: 'Live Node Console',
    desc: 'Add, remove, and monitor Supabase projects with real-time health checks, latency, and storage metrics.',
    color: 'from-amber-400 to-orange-500',
    shadow: 'shadow-amber-500/10',
  },
  {
    icon: Zap,
    title: 'Parallel Query Engine',
    desc: 'Queries fan out across all connected databases simultaneously. Results are merged and deduplicated client-side.',
    color: 'from-rose-400 to-pink-500',
    shadow: 'shadow-rose-500/10',
  },
  {
    icon: Shield,
    title: 'Browser-Only Privacy',
    desc: 'No backend server. Your API keys and URLs stay in localStorage, never transmitted to third parties.',
    color: 'from-cyan-400 to-sky-500',
    shadow: 'shadow-cyan-500/10',
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Connect',
    desc: 'Add your Supabase Free Tier project URLs and anon keys through the Cluster Console.',
    icon: Server,
  },
  {
    number: '2',
    title: 'Pool',
    desc: 'Nodes are automatically detected, health-checked, and organized into a consistent hash ring.',
    icon: Network,
  },
  {
    number: '3',
    title: 'Scale',
    desc: 'Read/write data across the unified cluster. Add more nodes anytime to increase capacity.',
    icon: Database,
  },
];

export default function LandingPage({ onLaunch }: LandingPageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans">
      {/* ── Navbar ── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#020617]/80 backdrop-blur-xl border-b border-slate-800/50 shadow-lg shadow-black/10'
            : 'bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-950/30">
              <Cpu className="h-4.5 w-4.5 text-slate-950" />
            </div>
            <span className="text-sm font-extrabold tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              SUPAMERGE
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors tracking-wide uppercase"
              >
                {item.label}
              </button>
            ))}
            <Button
              onClick={onLaunch}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950/30"
            >
              Launch App
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800/50 bg-[#020617]/95 backdrop-blur-xl">
            <div className="px-6 py-4 space-y-3">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="block w-full text-left text-sm font-semibold text-slate-400 hover:text-slate-200 py-2 transition-colors"
                >
                  {item.label}
                </button>
              ))}
              <Button
                onClick={onLaunch}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white mt-2"
              >
                Launch App
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 h-96 w-96 rounded-full bg-emerald-500/5 blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-blue-500/4 blur-3xl" />
          <div className="absolute top-1/3 right-1/3 h-64 w-64 rounded-full bg-purple-500/3 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-6 py-24 sm:py-32">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3.5 py-1 text-[11px] font-semibold tracking-wide text-emerald-400 mb-8">
              <Cpu className="h-3.5 w-3.5" />
              Introducing SupaMerge v2.0
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              <span className="bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Unify Your Supabase
              </span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Free Tier Databases
              </span>
            </h1>

            {/* Description */}
            <p className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed max-w-2xl">
              Pool multiple Supabase Free Tier projects into a single virtual cluster. Shard key-value data,
              distribute file storage, and merge AI vector memories across nodes — all in your browser.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button
                onClick={onLaunch}
                size="lg"
                className="h-12 px-8 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-2xl shadow-emerald-950/40 hover:shadow-emerald-950/60 transition-all duration-200 hover:-translate-y-0.5"
              >
                Launch Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => scrollTo('features')}
                size="lg"
                variant="outline"
                className="h-12 px-8 border-slate-700 text-slate-300 hover:bg-slate-800/50 hover:text-white text-sm font-semibold"
              >
                Explore Features
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Stats bar */}
            <div className="mt-16 flex flex-wrap items-center gap-8 text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>No backend server</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Browser-only SPA</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Consistent hashing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          {/* Section header */}
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">
              Core Capabilities
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Scale Beyond Free
              </span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
              Six integrated systems that turn your collection of Free Tier databases into a unified distributed cluster.
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative rounded-xl border border-slate-800/60 bg-[#070d1e]/60 backdrop-blur-sm p-6 transition-all duration-200 hover:-translate-y-1 hover:border-slate-700/80 hover:shadow-2xl hover:shadow-black/30"
                >
                  {/* Gradient border effect on hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-800/0 via-slate-800/0 to-slate-800/0 group-hover:from-emerald-500/[0.02] group-hover:via-slate-800/10 group-hover:to-emerald-500/[0.02] transition-all duration-500 pointer-events-none" />

                  <div className="relative z-10 space-y-4">
                    <div
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${feature.color} ${feature.shadow} shadow-lg`}
                    >
                      <Icon className="h-5 w-5 text-slate-950" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                      {feature.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works Section ── */}
      <section id="how-it-works" className="relative py-24 sm:py-32 border-t border-slate-800/40">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">
              Simple Workflow
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Three Steps to a{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Unified Cluster
              </span>
            </h2>
            <p className="mt-4 text-sm sm:text-base text-slate-400 leading-relaxed">
              No complex infrastructure. Just add your Supabase projects and start pooling.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 relative">
            {/* Connector line */}
            <div className="hidden md:block absolute top-12 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-0.5 bg-gradient-to-r from-emerald-500/40 via-teal-500/40 to-emerald-500/40" />

            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-xl shadow-emerald-950/30 border border-emerald-400/20">
                    <Icon className="h-6 w-6 text-slate-950" />
                  </div>
                  <div className="mt-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-slate-400 border border-slate-700">
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">{step.title}</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed max-w-xs">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="relative py-24 sm:py-32 border-t border-slate-800/40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="relative rounded-2xl border border-slate-800/60 bg-[#070d1e]/60 backdrop-blur-sm p-8 sm:p-12 shadow-2xl overflow-hidden">
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/8 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-60 w-60 rounded-full bg-blue-500/6 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-xl shadow-emerald-950/30 border border-emerald-400/20">
                <Cpu className="h-7 w-7 text-slate-950" />
              </div>

              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Ready to Max Out Your{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Free Tier?
                </span>
              </h2>
              <p className="text-sm sm:text-base text-slate-400 max-w-lg mx-auto leading-relaxed">
                Connect multiple Supabase projects and build without limits.
                Your data, your keys, your cluster.
              </p>
              <Button
                onClick={onLaunch}
                size="lg"
                className="h-12 px-10 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-2xl shadow-emerald-950/40 hover:shadow-emerald-950/60 transition-all duration-200 hover:-translate-y-0.5"
              >
                Launch the Application
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-800/40 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Cpu className="h-3.5 w-3.5 text-slate-600" />
            SupaMerge &copy; {new Date().getFullYear()}
          </div>
          <div className="text-xs text-slate-600">
            Built with React 19, Supabase, and Tailwind CSS
          </div>
        </div>
      </footer>
    </div>
  );
}
