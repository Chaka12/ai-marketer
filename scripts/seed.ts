/**
 * Seed the database with a complete demo workspace so the user can immediately
 * see the system in action without having to upload anything.
 *
 * Run with:  bun run seed
 */
import { db } from '../src/lib/db'
import { promises as fs } from 'fs'
import path from 'path'
import sharp from 'sharp'

// Portable path — uses process.cwd() so it works on any machine.
// Falls back to the project's uploads directory: <cwd>/uploads/demo
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'demo')

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
}

/**
 * Generate 7 simple demo product photos using sharp — coloured rectangles
 * with text. This keeps the seed self-contained (no external image fetches).
 */
async function generateDemoImages() {
  const palette: { name: string; bg: string; fg: string; label: string }[] = [
    { name: 'handbag-red', bg: '#7f1d1d', fg: '#fef2f2', label: 'Red Handbag' },
    { name: 'handbag-cream', bg: '#fef3c7', fg: '#7c2d12', label: 'Cream Handbag' },
    { name: 'storefront', bg: '#1e293b', fg: '#e2e8f0', label: 'Storefront' },
    { name: 'customer-1', bg: '#065f46', fg: '#ecfdf5', label: 'Happy Customer' },
    { name: 'flat-lay', bg: '#7c3aed', fg: '#f5f3ff', label: 'Summer Flat Lay' },
    { name: 'detail-1', bg: '#b45309', fg: '#fffbeb', label: 'Craftsmanship Detail' },
    { name: 'event', bg: '#be123c', fg: '#fff1f2', label: 'Launch Event' },
  ]

  const files: { filename: string; filePath: string }[] = []

  for (const p of palette) {
    const filename = `${p.name}.jpg`
    const filePath = path.join(UPLOADS_DIR, filename)

    const svg = `<svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1080" fill="${p.bg}" />
      <text x="540" y="520" font-family="Georgia, serif" font-size="72" font-weight="bold" fill="${p.fg}" text-anchor="middle">Summer Collection</text>
      <text x="540" y="620" font-family="Georgia, serif" font-size="44" fill="${p.fg}" text-anchor="middle" opacity="0.85">${p.label}</text>
      <text x="540" y="700" font-family="Georgia, serif" font-size="32" fill="${p.fg}" text-anchor="middle" opacity="0.6">Demo Asset · Maseru</text>
    </svg>`

    await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toFile(filePath)
    files.push({ filename, filePath })
  }

  return files
}

async function main() {
  console.log('🌱 Seeding AI Content Engine…')

  // Wipe (idempotent)
  await db.auditLog.deleteMany()
  await db.postAnalytics.deleteMany()
  await db.post.deleteMany()
  await db.assetAnalysis.deleteMany()
  await db.asset.deleteMany()
  await db.product.deleteMany()
  await db.brandRule.deleteMany()
  await db.destination.deleteMany()
  await db.socialAccount.deleteMany()
  await db.campaign.deleteMany()
  await db.performanceSnapshot.deleteMany()
  await db.aIConversation.deleteMany()
  await db.brand.deleteMany()
  await db.workspaceMember.deleteMany()
  await db.workspace.deleteMany()
  await db.user.deleteMany()

  // Owner
  const owner = await db.user.create({
    data: {
      email: 'owner@contentengine.demo',
      name: 'Demo Owner',
    },
  })

  // Workspace
  const workspace = await db.workspace.create({
    data: {
      name: 'Maison Été',
      slug: 'maison-ete',
      ownerId: owner.id,
      approvalMode: 'assisted',
    },
  })

  await db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: owner.id,
      role: 'owner',
    },
  })

  // Brand
  const brand = await db.brand.create({
    data: {
      workspaceId: workspace.id,
      name: 'Maison Été',
      description: 'Luxury local fashion retailer based in Maseru, Lesotho.',
      audience: 'Women 25–45 in Lesotho and the Free State.',
      location: 'Maseru, Lesotho',
      personality: 'Elegant, warm, confident.',
      writingStyle:
        'Short paragraphs. Conversational. Never corporate. One idea per post.',
      cta: 'Visit the store or message us on WhatsApp.',
      avoid: JSON.stringify([
        'Excessive emojis',
        'Fake urgency ("last chance!", "hurry!")',
        'Unsupported claims ("best in the country")',
        'Generic motivational quotes',
      ]),
      vocabularyUse: JSON.stringify([
        'collection',
        'discover',
        'visit us',
        'crafted',
        'season',
      ]),
      vocabularyAvoid: JSON.stringify([
        'cheap',
        'guaranteed',
        'best in the country',
        'BUY NOW',
        'limited time offer',
      ]),
    },
  })

  // Brand rules
  await db.brandRule.createMany({
    data: [
      {
        brandId: brand.id,
        type: 'prohibition',
        rule: 'Never claim a product is "handmade" unless explicitly verified.',
      },
      {
        brandId: brand.id,
        type: 'prohibition',
        rule: 'No before/after claims about appearance.',
      },
      {
        brandId: brand.id,
        type: 'guideline',
        rule: 'Always mention the Maseru store at least once per promotional post.',
      },
      {
        brandId: brand.id,
        type: 'guideline',
        rule: 'Use at most 5 hashtags per post.',
      },
      {
        brandId: brand.id,
        type: 'preference',
        rule: 'Prewrite captions in English; avoid colloquialisms that don\'t translate.',
      },
    ],
  })

  // Products
  await db.product.createMany({
    data: [
      {
        brandId: brand.id,
        name: 'Été Tote — Red',
        price: 'M 950',
        description: 'Hand-finished leather tote in summer red.',
        features: JSON.stringify(['Full-grain leather', 'Cotton lining', 'Brass hardware']),
        promotion: '20% off launch week',
        promotionExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        availability: 'In stock',
      },
      {
        brandId: brand.id,
        name: 'Été Crossbody — Cream',
        price: 'M 720',
        description: 'Lightweight crossbody in natural cream.',
        features: JSON.stringify(['Vegetable-tanned leather', 'Adjustable strap']),
        availability: 'In stock',
      },
      {
        brandId: brand.id,
        name: 'Sandstone Scarf',
        price: 'M 280',
        description: 'Linen-blend scarf in sandstone tones.',
        features: JSON.stringify(['70% linen, 30% silk', 'Hand-rolled edges']),
        availability: 'Pre-order',
      },
    ],
  })

  // Social account + destinations
  const fbAccount = await db.socialAccount.create({
    data: {
      workspaceId: workspace.id,
      platform: 'facebook',
      name: 'Maison Été — Facebook Page',
      accountId: 'demo_page_001',
      accessToken: 'demo_token_for_sandbox_only',
      tokenExpiry: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      status: 'connected',
    },
  })

  const pageDestination = await db.destination.create({
    data: {
      socialAccountId: fbAccount.id,
      type: 'page',
      name: 'Maison Été Page',
      externalId: 'demo_page_001',
      automationStatus: 'automated',
      contentStyleHint: 'Polished, brand-led. Mirror the website tone.',
    },
  })

  const groupDestination = await db.destination.create({
    data: {
      socialAccountId: fbAccount.id,
      type: 'group',
      name: 'Maseru Fashion Lovers',
      externalId: 'demo_group_001',
      automationStatus: 'manual',
      contentStyleHint: 'Conversational. Address members as friends, not customers.',
      allowedFrequency: '1x per week',
    },
  })

  // Campaign
  const campaign = await db.campaign.create({
    data: {
      workspaceId: workspace.id,
      brandId: brand.id,
      name: 'Summer Collection Launch',
      objective: 'awareness',
      contentMix: JSON.stringify([
        { pillar: 'product', percentage: 25 },
        { pillar: 'educational', percentage: 20 },
        { pillar: 'lifestyle', percentage: 20 },
        { pillar: 'social_proof', percentage: 15 },
        { pillar: 'engagement', percentage: 20 },
      ]),
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'active',
    },
  })

  // Demo images
  await ensureUploadsDir()
  const imageFiles = await generateDemoImages()

  // Assets + analyses
  const assetSubjects = [
    { subject: 'Red handbag on a marble display table', setting: 'Retail store', pillar: 'product', uses: ['product_showcase', 'announcement'] },
    { subject: 'Cream handbag held by a model', setting: 'Store', pillar: 'lifestyle', uses: ['lifestyle', 'social_proof'] },
    { subject: 'Storefront facade on Kingsway Road', setting: 'Outdoor', pillar: 'community', uses: ['announcement', 'community'] },
    { subject: 'Smiling customer leaving with purchase', setting: 'Store', pillar: 'social_proof', uses: ['social_proof', 'community'] },
    { subject: 'Flat lay of summer collection', setting: 'Studio', pillar: 'product', uses: ['product_showcase', 'lifestyle'] },
    { subject: 'Close-up of brass hardware and stitching', setting: 'Studio', pillar: 'educational', uses: ['educational', 'product_showcase'] },
    { subject: 'Launch event setup in store', setting: 'Store', pillar: 'engagement', uses: ['engagement', 'announcement'] },
  ]

  for (let i = 0; i < imageFiles.length; i++) {
    const f = imageFiles[i]
    const meta = assetSubjects[i]
    const asset = await db.asset.create({
      data: {
        workspaceId: workspace.id,
        brandId: brand.id,
        campaignId: campaign.id,
        type: 'image',
        filename: f.filename,
        filePath: f.filePath,
        mimeType: 'image/jpeg',
        fileSize: 0,
        width: 1080,
        height: 1080,
        analysisStatus: 'analyzed',
      },
    })
    await db.assetAnalysis.create({
      data: {
        assetId: asset.id,
        subject: meta.subject,
        setting: meta.setting,
        objects: JSON.stringify(['handbag', 'leather goods', 'display']),
        peopleCount: meta.pillar === 'social_proof' ? 1 : 0,
        emotion: meta.pillar === 'social_proof' ? 'smiling' : 'calm',
        product: 'Summer Collection',
        quality: 'high',
        visibleText: 'Summer 2026',
        suggestedUses: JSON.stringify(meta.uses),
        rawAnalysis: `Demo analysis for ${f.filename}`,
      },
    })
  }

  // Pre-generated posts (so the dashboard isn't empty on first load)
  const assets = await db.asset.findMany({ where: { workspaceId: workspace.id } })
  const captions = [
    {
      pillar: 'product',
      objective: 'awareness',
      hook: 'There is something new waiting…',
      caption: 'Meet the Été Tote in summer red. Hand-finished leather, brass hardware, and just enough room for everything Maseru demands of a day.\n\nAvailable now at our Kingsway Road store.',
      cta: 'Visit the store or message us on WhatsApp.',
      hashtags: ['#MaisonÉté', '#SummerCollection', '#Maseru', '#LeatherGoods', '#SlowFashion'],
      day: 'Monday',
      time: '09:00',
      destination: pageDestination,
      status: 'pending_approval',
    },
    {
      pillar: 'educational',
      objective: 'engagement',
      hook: 'Ever wondered why full-grain leather ages the way it does?',
      caption: 'Full-grain leather keeps the top layer intact, which means it absorbs the oils from your hands and develops a patina unique to you.\n\nThat is why our Été Tote will look better in five years than it does today.',
      cta: 'Visit the store or message us on WhatsApp.',
      hashtags: ['#LeatherCraft', '#SlowFashion', '#Maseru', '#MaisonÉté'],
      day: 'Tuesday',
      time: '13:00',
      destination: pageDestination,
      status: 'pending_approval',
    },
    {
      pillar: 'lifestyle',
      objective: 'awareness',
      hook: 'A morning in Maseru, the Été way.',
      caption: 'Coffee, a slow walk down Kingsway, and the right bag for both.\n\nThe Cream Crossbody is light enough to forget you are wearing it.',
      cta: 'Visit the store or message us on WhatsApp.',
      hashtags: ['#MaseruMornings', '#MaisonÉté', '#SummerCollection', '#Crossbody'],
      day: 'Wednesday',
      time: '11:00',
      destination: pageDestination,
      status: 'pending_approval',
    },
    {
      pillar: 'social_proof',
      objective: 'engagement',
      hook: '“I have had mine for two years and it still looks better than the day I bought it.”',
      caption: 'Thank you to everyone who shares their Été stories with us. Your trust is the whole reason we do this.',
      cta: 'Visit the store or message us on WhatsApp.',
      hashtags: ['#MaisonÉté', '#CustomerStory', '#Maseru'],
      day: 'Thursday',
      time: '15:00',
      destination: pageDestination,
      status: 'pending_approval',
    },
    {
      pillar: 'promotional',
      objective: 'sales',
      hook: 'Launch week — 20% off the Été Tote.',
      caption: 'To celebrate the Summer Collection, the Été Tote in red is 20% off this week only.\n\nAvailable at our Kingsway Road store while stocks last.',
      cta: 'Visit the store or message us on WhatsApp.',
      hashtags: ['#MaisonÉté', '#LaunchWeek', '#Maseru', '#Sale'],
      day: 'Friday',
      time: '17:00',
      destination: pageDestination,
      status: 'pending_approval',
    },
    {
      pillar: 'engagement',
      objective: 'engagement',
      hook: 'Question for the Été community:',
      caption: 'If you could only carry one bag all summer, what colour would it be?\n\nRed, cream, or something we should consider for autumn?',
      cta: 'Reply in the comments.',
      hashtags: ['#MaisonÉté', '#SummerDebate', '#Maseru'],
      day: 'Saturday',
      time: '18:00',
      destination: pageDestination,
      status: 'pending_approval',
    },
    {
      pillar: 'community',
      objective: 'awareness',
      hook: 'We are on Kingsway Road, opposite the old post office.',
      caption: 'Come say hello. We would love to show you the new collection in person.\n\nOpen Monday to Saturday, 9 to 5.',
      cta: 'Visit the store or message us on WhatsApp.',
      hashtags: ['#Maseru', '#MaisonÉté', '#VisitUs'],
      day: 'Sunday',
      time: '10:00',
      destination: pageDestination,
      status: 'pending_approval',
    },
    // Two additional scheduled posts to show the calendar populated
    {
      pillar: 'product',
      objective: 'sales',
      hook: 'Last day of launch week.',
      caption: 'Today is the final day to take 20% off the Été Tote in red.\n\nAfter today, the collection returns to full price.',
      cta: 'Visit the store or message us on WhatsApp.',
      hashtags: ['#MaisonÉté', '#LastDay', '#Maseru'],
      day: 'Next Monday',
      time: '09:00',
      destination: pageDestination,
      status: 'scheduled',
      scheduledOffset: 7 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000,
    },
    {
      pillar: 'engagement',
      objective: 'engagement',
      hook: 'Sunday reflection.',
      caption: 'What is one thing you bought this summer that you will still love next year?\n\nWe hope it is something from the Été collection.',
      cta: 'Reply in the comments.',
      hashtags: ['#MaisonÉté', '#SundayReflection', '#Maseru'],
      day: 'Next Sunday',
      time: '10:00',
      destination: groupDestination,
      status: 'scheduled',
      scheduledOffset: 13 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000,
    },
  ]

  for (let i = 0; i < captions.length; i++) {
    const c = captions[i]
    const asset = assets[i % assets.length]
    const scheduledAt = c.scheduledOffset
      ? new Date(Date.now() + c.scheduledOffset)
      : undefined
    const publishedAt = c.status === 'published' ? new Date(Date.now() - 12 * 60 * 60 * 1000) : null

    const post = await db.post.create({
      data: {
        workspaceId: workspace.id,
        brandId: brand.id,
        campaignId: campaign.id,
        assetId: asset.id,
        destinationId: c.destination.id,
        objective: c.objective,
        contentPillar: c.pillar,
        hook: c.hook,
        caption: c.caption,
        cta: c.cta,
        hashtags: JSON.stringify(c.hashtags),
        altText: `Maison Été — ${c.pillar} post`,
        status: c.status,
        approvalMode: workspace.approvalMode,
        scheduledAt: scheduledAt ?? null,
        publishedAt,
        publishingMethod: c.destination.type === 'page' ? 'api' : 'manual',
        confidence: 0.91,
      },
    })

    // Mock analytics for some posts so the analytics screen has data
    if (c.status === 'published' || c.status === 'scheduled') {
      const baseReach = c.pillar === 'lifestyle' ? 4200 : c.pillar === 'social_proof' ? 3800 : 2600
      const reactions = Math.floor(baseReach * 0.06)
      const comments = Math.floor(baseReach * 0.012)
      const shares = Math.floor(baseReach * 0.008)
      await db.postAnalytics.create({
        data: {
          postId: post.id,
          reach: baseReach,
          impressions: Math.floor(baseReach * 1.4),
          reactions,
          comments,
          shares,
          clicks: Math.floor(baseReach * 0.04),
          engagementRate: (reactions + comments + shares) / baseReach,
        },
      })
    }
  }

  // Historical published posts for the learning engine
  const historicalPillars: { pillar: string; objective: string; reach: number; caption: string }[] = [
    { pillar: 'lifestyle', objective: 'awareness', reach: 5200, caption: 'A quiet morning at the store.' },
    { pillar: 'product', objective: 'awareness', reach: 2400, caption: 'New crossbody in cream.' },
    { pillar: 'social_proof', objective: 'engagement', reach: 4900, caption: 'A note from a customer.' },
    { pillar: 'educational', objective: 'engagement', reach: 3100, caption: 'Why full-grain leather?' },
    { pillar: 'promotional', objective: 'sales', reach: 1800, caption: 'Last chance: spring sale.' },
    { pillar: 'engagement', objective: 'engagement', reach: 2900, caption: 'What is your summer colour?' },
    { pillar: 'community', objective: 'awareness', reach: 2200, caption: 'Open Saturday.' },
    { pillar: 'lifestyle', objective: 'awareness', reach: 4800, caption: 'Maseru evenings.' },
  ]
  for (const h of historicalPillars) {
    const asset = assets[Math.floor(Math.random() * assets.length)]
    const publishedAt = new Date(Date.now() - (10 + Math.random() * 20) * 24 * 60 * 60 * 1000)
    const post = await db.post.create({
      data: {
        workspaceId: workspace.id,
        brandId: brand.id,
        campaignId: campaign.id,
        assetId: asset.id,
        destinationId: pageDestination.id,
        objective: h.objective,
        contentPillar: h.pillar,
        hook: h.caption,
        caption: h.caption,
        cta: 'Visit the store or message us on WhatsApp.',
        hashtags: JSON.stringify(['#MaisonÉté', '#Maseru']),
        altText: `Historical ${h.pillar} post`,
        status: 'published',
        publishedAt,
        externalPostId: `sim_hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        confidence: 0.85,
      },
    })
    const reactions = Math.floor(h.reach * 0.06)
    const comments = Math.floor(h.reach * 0.012)
    const shares = Math.floor(h.reach * 0.008)
    await db.postAnalytics.create({
      data: {
        postId: post.id,
        reach: h.reach,
        impressions: Math.floor(h.reach * 1.4),
        reactions,
        comments,
        shares,
        clicks: Math.floor(h.reach * 0.04),
        engagementRate: (reactions + comments + shares) / h.reach,
      },
    })
  }

  // AI conversation welcome
  await db.aIConversation.create({
    data: {
      workspaceId: workspace.id,
      messages: JSON.stringify([
        {
          role: 'assistant',
          content:
            "Hi 👋 I am the Maison Été marketing assistant. I can see your Summer Collection Launch campaign is active with 7 posts awaiting approval and 2 scheduled for next week. Ask me anything — for example, \"what performed best last month?\" or \"make the Friday caption less salesy\".",
          timestamp: new Date().toISOString(),
        },
      ]),
    },
  })

  console.log(`✅ Seed complete.`)
  console.log(`   Workspace: ${workspace.slug}`)
  console.log(`   Brand: ${brand.name}`)
  console.log(`   Campaign: ${campaign.name}`)
  console.log(`   Assets: ${assets.length}`)
  console.log(`   Posts: ${await db.post.count({ where: { workspaceId: workspace.id } })}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
