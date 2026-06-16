import { useState, useEffect } from 'react';
import {
  Cpu, Database, Key, Layers, Brain, Terminal as TerminalIcon,
  ChevronRight, ArrowRight, Server, Network, Zap,
  CheckCircle2, Menu, X, Shield, Moon, Sun, Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Terminal } from '@/components/ui/terminal';
import { TextHoverEffect } from '@/components/ui/text-hover-effect';
import { useTheme } from '../hooks/useTheme';
import logoSrc from '../assets/logo.png';

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
    icon: TerminalIcon,
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
  const { setTheme, theme, effective } = useTheme();
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
    <div className="min-h-screen font-sans bg-mesh" style={{ backgroundColor: 'var(--color-canvas)', color: 'var(--color-text)' }}>
      {/* ── Navbar ── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'backdrop-blur-xl border-b shadow-lg shadow-black/10'
            : 'bg-transparent'
        }`}
        style={scrolled ? { backgroundColor: 'var(--color-canvas)', borderColor: 'var(--color-border)' } : {}}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img src={logoSrc} alt="SupaMerge" className="h-9 w-9 rounded-lg" />
            <span className="text-sm font-extrabold tracking-wider" style={{ color: 'var(--color-logo-text)' }}>
              SUPAMERGE
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-xs font-semibold hover:text-slate-200 transition-colors tracking-wide uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {item.label}
              </button>
            ))}
            <div className="flex items-center gap-2 rounded-lg border p-0.5" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface)' }}>
              <button
                onClick={() => setTheme('dark')}
                className={`rounded-md p-1.5 transition-all ${effective === 'dark' ? 'bg-slate-700 text-emerald-400 shadow-sm' : ''}`}
                style={{ color: effective === 'dark' ? undefined : 'var(--color-text-muted)' }}
                title="Dark mode"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`rounded-md p-1.5 transition-all ${effective === 'light' ? 'bg-slate-700 text-emerald-400 shadow-sm' : ''}`}
                style={{ color: effective === 'light' ? undefined : 'var(--color-text-muted)' }}
                title="Light mode"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setTheme('system')}
                className={`rounded-md p-1.5 transition-all ${theme === 'system' ? 'bg-slate-700 text-emerald-400 shadow-sm' : ''}`}
                style={{ color: theme === 'system' ? undefined : 'var(--color-text-muted)' }}
                title="Follow system"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
            </div>
            <a
              href="https://github.com/demgufever-arch/Supamerge"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all hover:-translate-y-0.5"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
            >
              <img src="https://cdn-icons-png.flaticon.com/512/2111/2111432.png" alt="GitHub" className="h-3.5 w-3.5 dark:brightness-0 dark:invert" />
              GitHub
            </a>
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
            className="md:hidden p-2 transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t backdrop-blur-xl" style={{ backgroundColor: 'var(--color-canvas)', borderColor: 'var(--color-border)' }}>
            <div className="px-6 py-4 space-y-3">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollTo(item.id)}
                  className="block w-full text-left text-sm font-semibold py-2 transition-colors"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {item.label}
                </button>
              ))}
              <a
                href="https://github.com/demgufever-arch/Supamerge"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-lg border py-2 text-sm font-semibold transition-colors mt-2"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                <img src="https://cdn-icons-png.flaticon.com/512/2111/2111432.png" alt="GitHub" className="h-4 w-4 dark:brightness-0 dark:invert" />
                GitHub
              </a>
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
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: 'linear-gradient(to right, var(--color-logo-text), var(--color-text-secondary))' }}>
                Unify Your Supabase
              </span>
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Free Tier Databases
              </span>
            </h1>

            {/* Description */}
            <p className="mt-6 text-base sm:text-lg leading-relaxed max-w-2xl" style={{ color: 'var(--color-text-secondary)' }}>
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
                className="h-12 px-8 text-sm font-semibold hover:bg-slate-800/50"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
              >
                Explore Features
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Stats bar */}
            <div className="mt-16 flex flex-wrap items-center gap-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>No backend server</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Browser-only SPA</span>
              </div>
              <div className="flex items-center gap-2">
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
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--color-logo-text)' }}>
              Everything You Need to{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Scale Beyond Free
              </span>
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
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
                  className="group relative rounded-xl border backdrop-blur-sm p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl"
                  style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
                >
                  {/* Gradient border effect on hover */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-800/0 via-slate-800/0 to-slate-800/0 group-hover:from-emerald-500/[0.02] group-hover:via-slate-800/10 group-hover:to-emerald-500/[0.02] transition-all duration-500 pointer-events-none" />

                  <div className="relative z-10 space-y-4">
                    <div
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${feature.color} ${feature.shadow} shadow-lg`}
                    >
                      <Icon className="h-5 w-5 text-slate-950" />
                    </div>
                    <h3 className="text-sm font-bold transition-colors" style={{ color: 'var(--color-text)' }}>
                      {feature.title}
                    </h3>
                    <p className="text-xs leading-relaxed transition-colors" style={{ color: 'var(--color-text-muted)' }}>
                      {feature.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Interactive Terminal Section ── */}
      <section className="relative py-24 sm:py-32 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mx-auto text-center mb-12">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">
              Developer Experience
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--color-logo-text)' }}>
              From Zero to{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Distributed Cluster
              </span>
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Set up your first unified cluster in seconds. No backend, no infrastructure — just pure browser magic.
            </p>
          </div>

          <div className="flex justify-center">
            <Terminal
              commands={[
                "npx supamerge init",
                "npm install @supamerge/core",
                "supamerge add node us-east-1",
                "supamerge add node eu-west-1",
                "supamerge connect --replicate 2x",
                "supamerge status --cluster",
              ]}
              outputs={{
                0: [
                  "✔ Created supamerge.json",
                  "✔ Detected browser environment",
                  "✔ Initialized virtual cluster (0 nodes)",
                ],
                1: ["+ @supamerge/core@2.0.1", "added 1 package in 1.2s"],
                2: [
                  "✔ Added node: us-east-1 (N. Virginia)",
                  "  → Status: connected",
                  "  → Latency: 23ms",
                ],
                3: [
                  "✔ Added node: eu-west-1 (Ireland)",
                  "  → Status: connected",
                  "  → Latency: 41ms",
                ],
                4: [
                  "✔ Replication factor set to 2x",
                  "✔ Hash ring rebuilt with 8 virtual nodes",
                  "✔ Cluster is now fault-tolerant",
                ],
                5: [
                  "╔══════════════════════════════════════╗",
                  "║  Unified Supabase Cluster Summary    ║",
                  "╠══════════════════════════════════════╣",
                  "║  Nodes:      2 connected              ║",
                  "║  Capacity:   1024 MB pooled           ║",
                  "║  Replication: 2x (active-passive)    ║",
                  "║  Latency:    32ms average            ║",
                  "╚══════════════════════════════════════╝",
                ],
              }}
              username="dev@supamerge"
              typingSpeed={40}
              delayBetweenCommands={1200}
              initialDelay={1500}
              enableSound={false}
            />
          </div>
        </div>
      </section>

      {/* ── How It Works Section ── */}
      <section id="how-it-works" className="relative py-24 sm:py-32 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-400">
              Simple Workflow
            </span>
            <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--color-logo-text)' }}>
              Three Steps to a{' '}
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Unified Cluster
              </span>
            </h2>
            <p className="mt-4 text-sm sm:text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
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
                  <div className="mt-3 inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold border" style={{ backgroundColor: 'var(--color-surface-alt)', color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>
                    {step.number}
                  </div>
                  <h3 className="mt-4 text-base font-bold" style={{ color: 'var(--color-text)' }}>{step.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section className="relative py-24 sm:py-32 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="relative rounded-2xl border backdrop-blur-sm p-8 sm:p-12 shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/8 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-60 w-60 rounded-full bg-blue-500/6 blur-3xl" />

            <div className="relative z-10 space-y-6">
              <img src={logoSrc} alt="SupaMerge" className="mx-auto h-14 w-14 rounded-2xl" />

              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ color: 'var(--color-logo-text)' }}>
                Ready to Max Out Your{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                  Free Tier?
                </span>
              </h2>
              <p className="text-sm sm:text-base max-w-lg mx-auto leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
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

      {/* ── Hover Effect Divider ── */}
      <section className="relative border-t py-12 sm:py-20 overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-5xl px-6">
          <div className="h-40 sm:h-48">
            <TextHoverEffect text="SUPAMERGE" duration={0.3} />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-8" style={{ borderColor: 'var(--color-border)' }}>
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <Cpu className="h-3.5 w-3.5" />
            SupaMerge &copy; {new Date().getFullYear()}
          </div>
          <a
            href="https://github.com/demgufever-arch/Supamerge"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold transition-colors hover:text-emerald-400"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <img src="https://cdn-icons-png.flaticon.com/512/2111/2111432.png" alt="GitHub" className="h-3.5 w-3.5 dark:brightness-0 dark:invert" />
            demgufever-arch/Supamerge
          </a>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Built with React 19, Supabase, and Tailwind CSS
          </div>
        </div>
      </footer>
    </div>
  );
}
