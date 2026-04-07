'use client'

import { useState } from 'react'
import { Palette, Type, AlignLeft, Zap, Heart, Shield, Star } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type Entity = 'Larchmont' | 'ScaleGenie' | 'Crosspoint'

interface ColorSwatch {
  name: string
  hex: string
  role?: string
}

interface FontSpec {
  name: string
  weight: string
  usage: 'Heading' | 'Body' | 'Mono' | 'Display' | 'Label'
}

interface BrandValue {
  icon: React.ElementType
  name: string
  description: string
}

interface BrandData {
  colors: ColorSwatch[]
  fonts: FontSpec[]
  voice: string[]
  primaryColor: string
  values: BrandValue[]
}

// ─────────────────────────────────────────────────────────
// Brand Data
// ─────────────────────────────────────────────────────────
const BRANDS: Record<Entity, BrandData> = {
  Larchmont: {
    colors: [
      { name: 'Sand',       hex: '#E8DFD0', role: 'Background' },
      { name: 'Cream',      hex: '#F5EFE4', role: 'Surface' },
      { name: 'Charcoal',   hex: '#2C2C2C', role: 'Primary Text' },
      { name: 'Warm Stone', hex: '#A89880', role: 'Secondary' },
      { name: 'Bark',       hex: '#6B5744', role: 'Accent' },
      { name: 'Sage',       hex: '#8A9E82', role: 'Success / Growth' },
      { name: 'Dust',       hex: '#D4C9B8', role: 'Border' },
      { name: 'Deep Night', hex: '#1A1410', role: 'Overlay' },
    ],
    fonts: [
      { name: 'Canela',         weight: '300 / 400',  usage: 'Heading' },
      { name: 'Söhne',          weight: '400 / 500',  usage: 'Body' },
      { name: 'Söhne Mono',     weight: '400',        usage: 'Mono' },
      { name: 'Canela Deck',    weight: '300',        usage: 'Display' },
    ],
    voice: [
      'Warm & Human',
      'Authoritative but not arrogant',
      'Minimal — every word earns its place',
      'Emotionally resonant',
      'Story-driven, never transactional',
    ],
    primaryColor: '#6B5744',
    values: [
      { icon: Heart,  name: 'Craft',       description: 'Every detail is intentional — beauty is never an afterthought.' },
      { icon: Star,   name: 'Clarity',     description: 'We distil complexity into things that are honest and easy to hold.' },
      { icon: Shield, name: 'Integrity',   description: 'We do what we say, and say what we mean — always.' },
      { icon: Zap,    name: 'Momentum',    description: 'We build toward something. Stagnation is the enemy of relevance.' },
    ],
  },

  ScaleGenie: {
    colors: [
      { name: 'Navy',        hex: '#0F1B38', role: 'Primary Brand' },
      { name: 'Electric',    hex: '#2563EB', role: 'Accent / CTA' },
      { name: 'Sky',         hex: '#BAD4FF', role: 'Tint' },
      { name: 'White',       hex: '#FFFFFF', role: 'Background' },
      { name: 'Light Gray',  hex: '#F4F6FA', role: 'Surface' },
      { name: 'Mid Gray',    hex: '#94A3B8', role: 'Secondary Text' },
      { name: 'Slate',       hex: '#334155', role: 'Body Text' },
      { name: 'Success',     hex: '#16A34A', role: 'Positive Signal' },
    ],
    fonts: [
      { name: 'Inter',       weight: '600 / 700',  usage: 'Heading' },
      { name: 'Inter',       weight: '400 / 500',  usage: 'Body' },
      { name: 'JetBrains Mono', weight: '400',     usage: 'Mono' },
      { name: 'Inter',       weight: '500',        usage: 'Label' },
    ],
    voice: [
      'Confident & Direct',
      'Data-informed, never data-drowned',
      'Empowering — we hand the controls to the operator',
      'Optimistic about scale',
      'Technical, but never exclusionary',
    ],
    primaryColor: '#2563EB',
    values: [
      { icon: Zap,    name: 'Speed',        description: 'We remove friction at every layer. Fast is a feature.' },
      { icon: Shield, name: 'Reliability',  description: 'When the system runs, operators can focus on what matters.' },
      { icon: Star,   name: 'Transparency', description: 'No black boxes. We show our work.' },
      { icon: Heart,  name: 'Operator-First', description: 'Every decision starts with: does this help the person running the business?' },
    ],
  },

  Crosspoint: {
    colors: [
      { name: 'Midnight',   hex: '#1A0D2E', role: 'Primary Brand' },
      { name: 'Royal',      hex: '#6B21A8', role: 'Core Accent' },
      { name: 'Lavender',   hex: '#C4B5FD', role: 'Soft Accent' },
      { name: 'Blush',      hex: '#F5F0FF', role: 'Background' },
      { name: 'Mist',       hex: '#EDE9F8', role: 'Surface' },
      { name: 'Gray 400',   hex: '#9CA3AF', role: 'Secondary Text' },
      { name: 'Charcoal',   hex: '#1F2937', role: 'Body Text' },
      { name: 'Gold',       hex: '#F59E0B', role: 'Highlight / Energy' },
    ],
    fonts: [
      { name: 'Playfair Display', weight: '700 / 800', usage: 'Heading' },
      { name: 'DM Sans',          weight: '400 / 500', usage: 'Body' },
      { name: 'DM Mono',          weight: '400',       usage: 'Mono' },
      { name: 'Playfair Display', weight: '400 italic', usage: 'Display' },
    ],
    voice: [
      'Purposeful & Grounded',
      'Inviting — we welcome people in',
      'Honest about struggle, hopeful about growth',
      'Community-first, never institutional',
      'Warm depth — serious without being heavy',
    ],
    primaryColor: '#6B21A8',
    values: [
      { icon: Heart,  name: 'Community',   description: 'No one grows alone. We exist to bring people into meaningful relationship.' },
      { icon: Shield, name: 'Trust',       description: 'We earn belonging by being consistent, safe, and true.' },
      { icon: Zap,    name: 'Activation',  description: 'Faith moves. We create environments where transformation happens.' },
      { icon: Star,   name: 'Excellence',  description: 'We honour people by doing our very best work — every Sunday, every season.' },
    ],
  },
}

const TABS: Entity[] = ['Larchmont', 'ScaleGenie', 'Crosspoint']

// ─────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
      {children}
    </h2>
  )
}

function ColorGrid({ colors }: { colors: ColorSwatch[] }) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
      {colors.map((c) => (
        <div key={c.hex} className="flex flex-col gap-2">
          <div
            className="h-12 w-full rounded-[8px] border border-black/10 shadow-sm"
            style={{ backgroundColor: c.hex }}
          />
          <div>
            <p className="text-[12px] font-medium text-[var(--text-primary)]">{c.name}</p>
            <p className="font-mono text-[10px] text-[var(--text-tertiary)]">{c.hex}</p>
            {c.role && (
              <p className="text-[10px] text-[var(--text-tertiary)] leading-tight">{c.role}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TypographyRow({ fonts }: { fonts: FontSpec[] }) {
  const USAGE_COLOR: Record<FontSpec['usage'], string> = {
    Heading: 'bg-violet-500/10 text-violet-500 border border-violet-500/20',
    Body:    'bg-blue-500/10 text-blue-500 border border-blue-500/20',
    Mono:    'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20',
    Display: 'bg-amber-500/10 text-amber-600 border border-amber-500/20',
    Label:   'bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]',
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {fonts.map((f, i) => (
        <div
          key={i}
          className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-4"
        >
          <span className={cn(
            'mb-3 inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium',
            USAGE_COLOR[f.usage]
          )}>
            {f.usage}
          </span>
          <p className="text-[16px] font-semibold text-[var(--text-primary)]">{f.name}</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">Weight {f.weight}</p>
        </div>
      ))}
    </div>
  )
}

function VoiceList({ voice }: { voice: string[] }) {
  return (
    <ul className="space-y-2">
      {voice.map((v, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--accent)]" />
          <span className="text-[14px] text-[var(--text-primary)]">{v}</span>
        </li>
      ))}
    </ul>
  )
}

function LogoPlaceholder({ primaryColor, name }: { primaryColor: string; name: string }) {
  return (
    <div
      className="flex h-32 w-full items-center justify-center rounded-[8px] border border-[var(--border)]"
      style={{ backgroundColor: primaryColor + '10' }}
    >
      <span
        className="select-none text-[18px] font-bold tracking-tight"
        style={{ color: primaryColor }}
      >
        [{name} Logo]
      </span>
    </div>
  )
}

function ValuesGrid({ values }: { values: BrandValue[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {values.map((v) => {
        const Icon = v.icon
        return (
          <div
            key={v.name}
            className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-4"
          >
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--accent-muted)]">
              <Icon className="h-4 w-4 text-[var(--accent)]" />
            </div>
            <p className="mb-1 text-[14px] font-semibold text-[var(--text-primary)]">{v.name}</p>
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{v.description}</p>
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────
export default function BrandPage() {
  const [activeEntity, setActiveEntity] = useState<Entity>('Larchmont')
  const brand = BRANDS[activeEntity]

  return (
    <div className="min-h-full p-6">
      <PageHeader
        title="Brand Identity"
        description="Visual & verbal identity system"
      />

      {/* Entity tabs */}
      <div className="mb-8 flex gap-0 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-0.5 w-fit">
        {TABS.map((entity) => (
          <button
            key={entity}
            onClick={() => setActiveEntity(entity)}
            className={cn(
              'rounded-[6px] px-4 py-1.5 text-[13px] font-medium transition-all duration-150',
              activeEntity === entity
                ? 'bg-[var(--surface-2)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {entity}
          </button>
        ))}
      </div>

      {/* Brand content */}
      <div className="space-y-10">

        {/* Logo */}
        <section>
          <SectionLabel>
            <span>Logo</span>
          </SectionLabel>
          <LogoPlaceholder primaryColor={brand.primaryColor} name={activeEntity} />
        </section>

        {/* Colors */}
        <section>
          <SectionLabel>
            <Palette className="h-3.5 w-3.5" />
            Color Palette
          </SectionLabel>
          <ColorGrid colors={brand.colors} />
        </section>

        {/* Typography */}
        <section>
          <SectionLabel>
            <Type className="h-3.5 w-3.5" />
            Typography
          </SectionLabel>
          <TypographyRow fonts={brand.fonts} />
        </section>

        {/* Tone of voice + Brand values side by side on large screens */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Tone of Voice */}
          <section>
            <SectionLabel>
              <AlignLeft className="h-3.5 w-3.5" />
              Tone of Voice
            </SectionLabel>
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-5">
              <VoiceList voice={brand.voice} />
            </div>
          </section>

          {/* Quick reference: primary color */}
          <section>
            <SectionLabel>
              <Palette className="h-3.5 w-3.5" />
              Primary Color
            </SectionLabel>
            <div className="rounded-[8px] border border-[var(--border)] overflow-hidden">
              <div
                className="h-24 w-full"
                style={{ backgroundColor: brand.primaryColor }}
              />
              <div className="bg-[var(--surface-2)] px-4 py-3 flex items-center justify-between">
                <span className="text-[13px] font-medium text-[var(--text-primary)]">
                  {brand.colors.find((c) => c.hex === brand.primaryColor)?.name ?? 'Primary'}
                </span>
                <span
                  className="font-mono text-[12px] text-[var(--text-tertiary)] rounded-[4px] bg-[var(--surface)] border border-[var(--border)] px-2 py-0.5 select-all"
                >
                  {brand.primaryColor}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Brand Values */}
        <section>
          <SectionLabel>
            <Star className="h-3.5 w-3.5" />
            Brand Values
          </SectionLabel>
          <ValuesGrid values={brand.values} />
        </section>

      </div>
    </div>
  )
}
