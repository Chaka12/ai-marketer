'use client'

import { AppProvider, useApp } from '@/components/providers/app-provider'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { Footer } from '@/components/layout/footer'
import { DashboardSection } from '@/components/sections/dashboard-section'
import { CreateSection } from '@/components/sections/create-section'
import { ApprovalSection } from '@/components/sections/approval-section'
import { CalendarSection } from '@/components/sections/calendar-section'
import { CampaignsSection } from '@/components/sections/campaigns-section'
import { AnalyticsSection } from '@/components/sections/analytics-section'
import { BrandSection } from '@/components/sections/brand-section'
import { AssistantSection } from '@/components/sections/assistant-section'
import { DistributionSection } from '@/components/sections/distribution-section'
import { SettingsSection } from '@/components/sections/settings-section'
import { AnimatePresence, motion } from 'framer-motion'

function SectionContent() {
  const { section } = useApp()
  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
        >
          {section === 'dashboard' && <DashboardSection />}
          {section === 'create' && <CreateSection />}
          {section === 'approval' && <ApprovalSection />}
          {section === 'calendar' && <CalendarSection />}
          {section === 'campaigns' && <CampaignsSection />}
          {section === 'analytics' && <AnalyticsSection />}
          {section === 'brand' && <BrandSection />}
          {section === 'assistant' && <AssistantSection />}
          {section === 'distribution' && <DistributionSection />}
          {section === 'settings' && <SettingsSection />}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}

function Shell() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex flex-1">
        {/* Sidebar — desktop */}
        <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
          <div className="sticky top-0 h-screen">
            <Sidebar />
          </div>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <SectionContent />
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default function Home() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
