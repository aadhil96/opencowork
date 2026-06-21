import type { AgentTool, Document, McpToolInfo, Playbook, RiskFlag, Settings, SubAgent } from '../types'

export const SUB_AGENTS: SubAgent[] = [
  {
    id: 'general_counsel',
    name: 'General Counsel',
    role: 'Broad legal analysis',
    description: 'All-round contract and legal document review',
    accent: 'bg-blue-500',
    systemPrompt: ''
  },
  {
    id: 'contract_reviewer',
    name: 'Contract Reviewer',
    role: 'Clause-by-clause analysis',
    description: 'Detailed review, red-lining, and missing protections',
    accent: 'bg-indigo-500',
    systemPrompt: `You are a meticulous contract reviewer. Your approach:
- Evaluate every clause individually; flag one-sided terms and deviations from market standard
- Prefix every suggested improvement with "REDLINE:" for easy scanning
- Rate overall contract balance: Seller-Favorable / Balanced / Buyer-Favorable
- Explicitly list missing clauses (force majeure, limitation of liability, dispute resolution, etc.)
- Cross-reference defined terms to catch inconsistencies or undefined references`
  },
  {
    id: 'risk_analyst',
    name: 'Risk Analyst',
    role: 'Legal risk & liability',
    description: 'Quantify exposure, worst-case scenarios, liability caps',
    accent: 'bg-red-500',
    systemPrompt: `You are a legal risk analyst specializing in exposure quantification. Your approach:
- Map every legal, financial, operational, and reputational risk with a severity matrix: Critical / High / Medium / Low
- Estimate financial exposure in dollar ranges where possible (e.g. "uncapped liability = potential $X–$X million")
- Model worst-case breach scenarios for Critical and High risks
- Scrutinize liability caps, indemnification scope, consequential damages waivers, and insurance obligations
- Produce a prioritized risk register: Risk → Probability → Impact → Mitigation recommendation
- Highlight compounding risks where two clauses together create greater exposure than each alone`
  },
  {
    id: 'compliance_officer',
    name: 'Compliance Officer',
    role: 'Regulatory & compliance',
    description: 'GDPR, AML, SOX, HIPAA, industry-specific regulation checks',
    accent: 'bg-emerald-500',
    systemPrompt: `You are a regulatory compliance specialist with expertise across global regimes. Your approach:
- Map every clause to applicable regulations: GDPR/UK GDPR, CCPA, AML/KYC, SOX, HIPAA, PCI-DSS, MiFID II, FCA rules, consumer protection laws
- Flag clauses that create compliance obligations, mandatory disclosures, or regulatory reporting duties
- Identify missing mandatory terms required by statute (e.g. GDPR Art. 28 DPA requirements)
- Assess data transfer mechanisms (SCCs, BCRs, adequacy decisions) for cross-border data flows
- Check for sanctions exposure, beneficial ownership disclosure, and anti-bribery (FCPA/UK Bribery Act) provisions
- Output format: [REGULATION] → [CLAUSE/ISSUE] → [RISK LEVEL] → [REQUIRED ACTION]`
  },
  {
    id: 'ip_counsel',
    name: 'IP Counsel',
    role: 'Intellectual property',
    description: 'Patents, trademarks, copyright, licensing & ownership',
    accent: 'bg-violet-500',
    systemPrompt: `You are an intellectual property lawyer with deep licensing and ownership expertise. Your approach:
- Analyze every IP ownership, assignment, and license grant with precision
- Flag work-for-hire ambiguities, invention assignment scope, and background vs. foreground IP distinctions
- Assess license exclusivity, sublicensing rights, field-of-use, territory, and duration restrictions
- Identify open-source software obligations (GPL, LGPL, Apache, MIT copyleft risks)
- Check for missing IP warranties (non-infringement, ownership, no prior assignments)
- Evaluate patent prosecution control, trade secret obligations, and publication rights
- Flag moral rights, personality rights, and database rights issues for EU-jurisdiction contracts
- Assess technology escrow and source code access provisions`
  },
  {
    id: 'employment_lawyer',
    name: 'Employment Lawyer',
    role: 'Employment & HR law',
    description: 'Contracts, non-competes, benefits, classification, termination',
    accent: 'bg-amber-500',
    systemPrompt: `You are a senior employment law specialist. Your approach:
- Review compensation, benefits, equity, bonus, and commission structures for enforceability
- Assess non-compete scope (geography, duration, activity) against jurisdiction-specific enforceability standards
- Flag restrictive covenants likely to be void or challengeable under local law
- Identify worker misclassification risks: employee vs. contractor analysis under IR35, ABC test, economic reality test
- Examine at-will vs. just-cause termination, notice periods, PILON, garden leave, and severance calculations
- Flag statutory minimums not met: minimum wage, rest breaks, FMLA/parental leave, protected characteristics
- Check whistleblower protections, grievance procedures, and workplace investigation protocols
- Identify post-employment obligations and their geographic enforceability`
  },
  {
    id: 'ma_analyst',
    name: 'M&A Analyst',
    role: 'Mergers & acquisitions',
    description: 'Due diligence, reps & warranties, deal structure, closing',
    accent: 'bg-rose-500',
    systemPrompt: `You are an M&A legal analyst specializing in complex transactions. Your approach:
- Scrutinize representations and warranties for completeness, accuracy risk, and knowledge qualifiers
- Analyze indemnification mechanics: baskets (tipping vs. deductible), caps, survival periods, escrow, and holdback
- Evaluate MAC/MAE definitions and carve-outs; assess whether COVID/force majeure events are excluded
- Review conditions to closing: regulatory approvals (HSR, FDI, merger control), consent requirements, financing conditions
- Map change-of-control clauses in material contracts; identify assignment restrictions needing third-party consent
- Assess earnout structures, purchase price adjustment mechanisms (locked-box vs. completion accounts)
- Review non-compete and key-person retention obligations post-closing
- Flag missing or weak disclosure schedules, bring-down conditions, and termination fee provisions
- Analyze equity rollover, management incentive plans, and tag-along/drag-along rights`
  },
  {
    id: 'litigation_specialist',
    name: 'Litigation Specialist',
    role: 'Dispute resolution & litigation',
    description: 'Dispute clauses, arbitration, jurisdiction, evidence strategy',
    accent: 'bg-orange-500',
    systemPrompt: `You are a litigation and dispute resolution specialist. Your approach:
- Analyze dispute resolution clauses: mediation → arbitration → litigation escalation ladders
- Evaluate arbitration clauses: seat, rules (ICC, LCIA, AAA, SIAC), number of arbitrators, language, confidentiality
- Assess governing law and jurisdiction selections for enforceability and strategic advantage
- Flag class action waivers, jury trial waivers, and limitation of actions periods
- Identify evidence and document retention obligations, litigation hold triggers
- Analyze injunctive relief provisions and emergency arbitrator access
- Evaluate fee-shifting, costs provisions, and prevailing party definitions
- Flag broad indemnification clauses that could create defense obligations in third-party litigation
- Assess contractual limitation periods vs. statutory limitation periods`
  },
  {
    id: 'real_estate_counsel',
    name: 'Real Estate Counsel',
    role: 'Property & real estate law',
    description: 'Leases, purchase agreements, title, zoning, development',
    accent: 'bg-teal-500',
    systemPrompt: `You are a real estate and property law specialist. Your approach:
- Review lease terms: rent escalation, CAM charges, exclusivity, use restrictions, assignment/subletting rights
- Analyze purchase agreements: due diligence periods, title insurance requirements, survey conditions
- Flag title defects, encumbrances, easements, restrictive covenants, and boundary issues
- Assess zoning compliance, planning permissions, and development rights
- Review break clauses, renewal options, ROFO/ROFR provisions in leases
- Evaluate construction and development contracts: milestone payments, delay penalties, defect liability periods
- Check environmental obligations, contamination disclosure requirements, and remediation obligations
- Assess landlord consent requirements, alienation provisions, and alienation premiums
- Flag anti-embarrassment clauses, overage/clawback provisions in development deals`
  },
  {
    id: 'tax_counsel',
    name: 'Tax Counsel',
    role: 'Tax law & structuring',
    description: 'Transaction tax, withholding, VAT/GST, transfer pricing',
    accent: 'bg-yellow-500',
    systemPrompt: `You are a transaction tax lawyer with cross-border expertise. Your approach:
- Identify all tax representations, warranties, and covenants; flag gaps in tax indemnities
- Analyze withholding tax obligations on payments (dividends, royalties, interest, services) under applicable treaties
- Flag VAT/GST treatment of transactions; identify reverse charge and place of supply issues
- Assess transfer pricing provisions in intercompany agreements against arm's length standards
- Review tax-free reorganization requirements and potential tax leakage in M&A structures
- Identify stamp duty, SDLT, RETT, and other transfer taxes triggered by the transaction
- Flag anti-avoidance provisions: GAAR, BEPS, BEAT, GILTI, DAC6 disclosure obligations
- Check tax-sharing agreements, group relief provisions, and tax covenant obligations
- Assess tax gross-up provisions and most-favored-nation treatment clauses`
  },
  {
    id: 'data_privacy_officer',
    name: 'Privacy Officer',
    role: 'Data protection & privacy',
    description: 'GDPR, CCPA, cross-border transfers, DPAs, consent',
    accent: 'bg-cyan-500',
    systemPrompt: `You are a data protection and privacy law expert. Your approach:
- Map every personal data flow triggered by the contract; identify controller/processor roles
- Audit against GDPR Art. 28 requirements for Data Processing Agreements
- Flag lawful bases for processing; identify where consent mechanisms are required or inadequate
- Review data subject rights mechanisms: access, erasure, portability, objection, automated decision-making
- Assess cross-border transfer mechanisms: SCCs (new 2021 modules), BCRs, adequacy decisions, derogations
- Check data breach notification timelines (72-hour GDPR requirement, state law requirements)
- Identify CCPA/CPRA "sale of personal information" triggers and opt-out obligations
- Review privacy by design and security obligations: encryption, pseudonymization, access controls
- Flag retention schedules, deletion obligations, and data minimization compliance
- Check cookie consent, ePrivacy Directive obligations, and tracking technology disclosures`
  },
  {
    id: 'banking_finance',
    name: 'Finance Counsel',
    role: 'Banking & finance law',
    description: 'Loan agreements, security, covenants, regulatory capital',
    accent: 'bg-slate-500',
    systemPrompt: `You are a banking and finance lawyer specializing in complex debt transactions. Your approach:
- Analyze loan agreement structure: facility types, availability periods, utilization conditions
- Review financial covenants: leverage ratio, interest cover, minimum liquidity — assess headroom and cure rights
- Scrutinize security package: floating charge scope, fixed charge validity, perfection requirements
- Assess events of default: cross-default provisions, MAC definitions, ratings triggers
- Review mandatory prepayment events: change of control, asset disposals, excess cashflow sweeps
- Flag accordion facilities, incremental debt permissions, and restricted payment baskets
- Analyze intercreditor arrangements: subordination, standstill periods, enforcement rights
- Check regulatory capital implications, Basel III/IV treatment, and LMA standard alignment
- Assess guarantee and indemnity scope, limitations, and preservation provisions`
  },
  {
    id: 'web_researcher',
    name: 'Legal Web Researcher',
    role: 'Live web research',
    description: 'Searches the web for case law, statutes, and legal precedents',
    accent: 'bg-pink-500',
    systemPrompt: `You are a legal research specialist with access to live web search. Your approach:
- Use the web_search tool to find current legislation, case law, regulatory guidance, and legal precedents
- Always cite sources with URLs when referencing search results
- Cross-reference multiple sources before drawing conclusions
- Flag when information may be outdated and suggest authoritative sources to verify
- Structure research findings: Issue → Applicable Law → Leading Cases → Current Position → Practical Implications
- For statute questions: search for the current consolidated version and note recent amendments
- For case law: search for the leading case and check for subsequent distinguishing cases
- For regulatory questions: search for the regulator's official guidance and any enforcement actions`
  }
]

export function getSubAgent(id: string): SubAgent {
  return SUB_AGENTS.find(a => a.id === id) ?? SUB_AGENTS[0]
}

// Decide which specialist handles a turn: an explicit user choice wins; 'auto'
// (or unset) falls back to keyword routing.
export function resolveSubAgentId(activeSubAgentId: string | undefined, message: string, docName?: string): string {
  if (activeSubAgentId && activeSubAgentId !== 'auto') return activeSubAgentId
  return detectSubAgent(message, docName)
}

// Auto-route to the best sub-agent based on message content + document name
export function detectSubAgent(message: string, docName?: string): string {
  const text = (message + ' ' + (docName ?? '')).toLowerCase()

  const scores: Record<string, number> = {}

  const rules: [string, string[]][] = [
    ['web_researcher',       ['search web', 'look up', 'find online', 'case law', 'statute', 'regulation search', 'precedent', 'latest ruling', 'web search']],
    ['contract_reviewer',    ['review clause', 'redline', 'red-line', 'missing clause', 'one-sided', 'unfair term', 'contract review', 'clause by clause', 'nda', 'msa', 'sow', 'service agreement']],
    ['risk_analyst',         ['risk', 'liability', 'exposure', 'worst case', 'indemnif', 'uncapped', 'consequential', 'damages', 'insurance', 'penalty']],
    ['compliance_officer',   ['gdpr', 'ccpa', 'aml', 'kyc', 'sox', 'hipaa', 'regulatory', 'compliance', 'regulation', 'mandatory', 'disclosure', 'sanctions']],
    ['ip_counsel',           ['patent', 'trademark', 'copyright', 'intellectual property', 'ip ', 'license', 'open source', 'software license', 'assignment', 'work for hire', 'trade secret']],
    ['employment_lawyer',    ['employment', 'employee', 'contractor', 'non-compete', 'non compete', 'salary', 'termination', 'severance', 'hr', 'workers', 'redundancy', 'dismissal', 'ir35']],
    ['ma_analyst',           ['merger', 'acquisition', 'due diligence', 'share purchase', 'spa', 'earnout', 'closing', 'representations', 'warranties', 'mac clause', 'change of control']],
    ['litigation_specialist',['arbitration', 'dispute', 'litigation', 'jurisdiction', 'governing law', 'claim', 'proceedings', 'injunction', 'mediation', 'tribunal', 'limitation period']],
    ['real_estate_counsel',  ['lease', 'tenancy', 'landlord', 'tenant', 'property', 'real estate', 'conveyance', 'easement', 'zoning', 'planning', 'development', 'rent review']],
    ['tax_counsel',          ['tax', 'vat', 'gst', 'withholding', 'stamp duty', 'transfer pricing', 'beps', 'capital gains', 'corporation tax', 'taxable', 'tax indemnity']],
    ['data_privacy_officer', ['data protection', 'personal data', 'dpa', 'data processing', 'data subject', 'consent', 'privacy', 'breach notification', 'data transfer', 'processor']],
    ['banking_finance',      ['loan', 'credit facility', 'covenant', 'security', 'charge', 'lender', 'borrower', 'interest rate', 'debt', 'facility agreement', 'intercreditor', 'guarantee']],
  ]

  for (const [agentId, keywords] of rules) {
    scores[agentId] = 0
    for (const kw of keywords) {
      if (text.includes(kw)) scores[agentId] += 1
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return best && best[1] > 0 ? best[0] : 'general_counsel'
}

export const LEGAL_TOOLS: AgentTool[] = [
  {
    type: 'function',
    function: {
      name: 'extract_clauses',
      description: 'Extract all clauses of a specific type from the document (e.g. indemnification, termination, payment, confidentiality, liability)',
      parameters: {
        type: 'object',
        properties: {
          clause_type: {
            type: 'string',
            description: 'Type of clause to extract, e.g. "indemnification", "termination", "payment terms", "liability cap"'
          }
        },
        required: ['clause_type']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'identify_risks',
      description: 'Analyze the document and identify potentially risky or unfavorable clauses with severity levels',
      parameters: {
        type: 'object',
        properties: {
          perspective: {
            type: 'string',
            enum: ['buyer', 'seller', 'employee', 'employer', 'licensor', 'licensee', 'general'],
            description: 'Whose perspective to analyze risks from'
          }
        },
        required: ['perspective']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'summarize_document',
      description: 'Generate a structured executive summary of the entire document including parties, key obligations, key dates, and major terms',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_document',
      description: 'Search the document for a specific term, concept, or phrase',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term or concept to find in the document'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compare_to_standard',
      description: 'Compare a specific clause or section to what is considered market standard or typical practice',
      parameters: {
        type: 'object',
        properties: {
          clause: {
            type: 'string',
            description: 'The clause text or clause type to compare'
          }
        },
        required: ['clause']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for legal information, case law, statutes, regulatory guidance, or legal precedents. Use this whenever you need current or external legal information not present in the document.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query — be specific, e.g. "GDPR Article 28 Data Processing Agreement requirements" or "UK non-compete enforceability 2024"'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'legal_search',
      description: 'Search the CourtListener database for VERIFIED US case law. Returns real, citable cases with URLs and court details. USE THIS BEFORE making any case-law claim in deep-research mode. Never invent citations — if a case is not returned by this tool or by verify_citation, you must not cite it.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query — case name, topic, or legal issue, e.g. "qualified immunity excessive force"' },
          court: { type: 'string', description: 'Optional court filter, e.g. "scotus" for Supreme Court, "ca9" for 9th Circuit' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'verify_citation',
      description: 'Verify that a specific case citation is real by checking CourtListener. Use this for EVERY case you plan to cite. If the result begins with "UNVERIFIED", you must not include that citation in your response — either find an alternate verified case via legal_search, or tell the user no authoritative source was located.',
      parameters: {
        type: 'object',
        properties: {
          citation: { type: 'string', description: 'A case name or reporter cite, e.g. "Roe v. Wade" or "410 U.S. 113"' }
        },
        required: ['citation']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'compare_documents',
      description: 'Compare all documents currently loaded in this session against each other — surfaces conflicting terms, differing obligations, and inconsistent definitions. Only useful when two or more documents are attached.',
      parameters: { type: 'object', properties: {}, required: [] }
    }
  }
]

// MCP tool names are namespaced so they never collide with built-in legal tools.
// Tool names go to OpenAI-compatible APIs which require ^[a-zA-Z0-9_-]{1,64}$,
// so we slug each component before composing. A side map remembers which real
// serverId each slug routes back to (the user-visible name can be anything).
const MCP_PREFIX = 'mcp__'
const MAX_NAME = 64

// The model-visible name is a slug (sanitized + length-capped); we keep a side
// map back to the real serverId + original tool name so calls route correctly
// even when the user picks a server name with spaces/special chars or when the
// MCP server's own tool name happens to be longer than 64 chars.
const mcpRoutes = new Map<string, { serverId: string; toolName: string }>()

function slug(s: string): string {
  const cleaned = s.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return cleaned || 'x'
}

export function mcpToolsToAgentTools(tools: McpToolInfo[]): AgentTool[] {
  mcpRoutes.clear()
  const seen = new Set<string>()
  return tools
    .filter(t => t.name !== '__error__')
    .map(t => {
      const prefix = slug(t.serverId)
      const reserved = MCP_PREFIX.length * 2 + prefix.length
      const baseToolSlug = slug(t.name).slice(0, Math.max(1, MAX_NAME - reserved))
      // Deduplicate within this connect call in case slugs collide.
      let toolSlug = baseToolSlug
      let n = 1
      while (seen.has(`${prefix}/${toolSlug}`)) {
        const suffix = `_${n++}`
        toolSlug = baseToolSlug.slice(0, Math.max(1, baseToolSlug.length - suffix.length)) + suffix
      }
      seen.add(`${prefix}/${toolSlug}`)

      const fullName = `${MCP_PREFIX}${prefix}${MCP_PREFIX}${toolSlug}`.slice(0, MAX_NAME)
      mcpRoutes.set(fullName, { serverId: t.serverId, toolName: t.name })
      return {
        type: 'function' as const,
        function: {
          name: fullName,
          description: `[${t.serverName}] ${t.description}`.trim(),
          parameters: (t.inputSchema && typeof t.inputSchema === 'object'
            ? t.inputSchema
            : { type: 'object', properties: {} }) as Record<string, unknown>
        }
      }
    })
}

export function resolveMcpToolName(fullName: string): { serverId: string; name: string } | null {
  if (!fullName.startsWith(MCP_PREFIX)) return null
  const route = mcpRoutes.get(fullName)
  return route ? { serverId: route.serverId, name: route.toolName } : null
}

// Tools the deep-research mode needs unconditionally so the model can verify
// any case it would otherwise be tempted to invent.
const DEEP_RESEARCH_TOOLS = new Set(['legal_search', 'verify_citation', 'web_search'])

export function getActiveTools(settings: Settings, mcpTools: AgentTool[] = [], deepResearch = false): AgentTool[] {
  const enabled = new Set(
    settings.builtInSkills.filter(s => s.enabled).map(s => s.id)
  )
  // web_search and compare_documents are always available; in deep-research mode
  // we additionally force-enable legal_search + verify_citation.
  const always = new Set(['web_search', 'compare_documents'])
  if (deepResearch) for (const t of DEEP_RESEARCH_TOOLS) always.add(t)
  const builtIn = LEGAL_TOOLS.filter(t => enabled.has(t.function.name) || always.has(t.function.name))
  return [...builtIn, ...mcpTools]
}

// Synonym sets so "indemnification" also catches "indemnify", "hold harmless", etc.
const CLAUSE_SYNONYMS: Record<string, string[]> = {
  indemnification:         ['indemnif', 'hold harmless', 'defend'],
  termination:             ['terminat', 'expir', 'notice period', 'for cause', 'for convenience'],
  payment:                 ['payment', 'fee', 'invoice', 'price', 'consideration', 'remuneration', 'net 30', 'net 60'],
  confidentiality:         ['confidential', 'non-disclosure', 'proprietary information'],
  liability:               ['liabilit', 'limitation of liability', 'liable', 'consequential damages', 'cap on'],
  warranty:                ['warrant', 'representation', 'as-is', 'as is', 'fitness for'],
  'governing law':         ['governing law', 'jurisdiction', 'venue', 'choice of law'],
  'intellectual property': ['intellectual property', 'copyright', 'patent', 'trademark', 'work for hire', 'work made for hire'],
  'force majeure':         ['force majeure', 'act of god', 'beyond the reasonable control', 'beyond its control'],
  'dispute resolution':    ['arbitrat', 'mediat', 'dispute', 'litigation', 'tribunal'],
  'non-compete':           ['non-compete', 'non compete', 'restrictive covenant', 'non-solicit', 'solicitation'],
  'data protection':       ['personal data', 'data protection', 'gdpr', 'data processing', 'data subject'],
}

function splitBlocks(text: string): string[] {
  return text.split(/\n\s*\n|\r?\n/).map(s => s.trim()).filter(s => s.length > 25)
}

function clampExcerpt(s: string, max = 400): string {
  const clean = s.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max).trim() + '…' : clean
}

export function executeAgentTool(
  toolName: string,
  input: Record<string, unknown>,
  documents: Document[]
): string | Promise<string> {
  // MCP tools (`mcp__<server-slug>__<tool-slug>`) route via the side map back to
  // the real serverId + original tool name. Slug collisions or unknown tools
  // surface as a clear message rather than a silent miss.
  if (toolName.startsWith(MCP_PREFIX)) {
    if (!window.electronAPI?.mcpCallTool) return 'MCP is not available in this environment.'
    const route = resolveMcpToolName(toolName)
    if (!route) return `Unknown MCP tool: ${toolName}. Try reconnecting MCP servers in Settings.`
    return window.electronAPI.mcpCallTool(route.serverId, route.name, input)
  }

  // Web search is the only built-in tool that doesn't operate on a loaded document.
  if (toolName === 'web_search') {
    const query = String(input.query ?? '')
    if (!window.electronAPI?.webSearch) return 'Web search is not available in this environment.'
    return window.electronAPI.webSearch(query)
  }

  // Verified legal search and citation verification (CourtListener).
  // Both are document-independent and route directly to the main process.
  if (toolName === 'legal_search') {
    if (!window.electronAPI?.legalSearch) return 'Legal search is not available in this environment.'
    return window.electronAPI.legalSearch(String(input.query ?? ''), input.court ? String(input.court) : undefined)
  }
  if (toolName === 'verify_citation') {
    if (!window.electronAPI?.verifyCitation) return 'Citation verification is not available in this environment.'
    return window.electronAPI.verifyCitation(String(input.citation ?? ''))
  }

  if (documents.length === 0) return 'No document is currently loaded.'

  // For multi-document sessions, scanning tools see every doc concatenated with a header.
  const text = documents.length > 1
    ? documents.map(d => `===== DOCUMENT: ${d.name} =====\n${d.content}`).join('\n\n')
    : documents[0].content

  switch (toolName) {
    case 'extract_clauses': {
      const clauseType = String(input.clause_type ?? '').toLowerCase().trim()
      if (!clauseType) return 'No clause type specified.'
      const key = Object.keys(CLAUSE_SYNONYMS).find(k => k.includes(clauseType) || clauseType.includes(k))
      const keywords = key ? CLAUSE_SYNONYMS[key] : clauseType.split(/\s+/).filter(w => w.length > 2)
      const relevant = splitBlocks(text).filter(b => {
        const lb = b.toLowerCase()
        return keywords.some(kw => lb.includes(kw))
      })
      if (relevant.length === 0) {
        return `No clauses matching "${input.clause_type}" found. Searched for: ${keywords.join(', ')}.`
      }
      return `Found ${relevant.length} passage(s) related to "${input.clause_type}" (showing up to 8):\n\n` +
        relevant.slice(0, 8).map((b, i) => `${i + 1}. ${clampExcerpt(b)}`).join('\n\n')
    }

    case 'identify_risks': {
      const perspective = String(input.perspective ?? 'general')
      const riskKeywords: Record<string, { severity: RiskFlag['severity']; reason: string }> = {
        'unlimited liability':         { severity: 'high',   reason: 'Exposes party to uncapped financial risk' },
        'uncapped':                    { severity: 'high',   reason: 'No ceiling on liability or amounts owed' },
        'indemnify and hold harmless': { severity: 'high',   reason: 'Broad indemnification obligation' },
        'consequential damages':       { severity: 'high',   reason: 'Potential exposure to indirect/consequential losses' },
        'sole discretion':             { severity: 'medium', reason: 'Gives one party unchecked power to decide' },
        'automatic renewal':           { severity: 'medium', reason: 'Contract auto-renews without explicit consent' },
        'unilateral':                  { severity: 'medium', reason: 'One-sided modification rights' },
        'liquidated damages':          { severity: 'medium', reason: 'Pre-determined penalties may be disproportionate' },
        'non-compete':                 { severity: 'high',   reason: 'May restrict future business activities' },
        'perpetual license':           { severity: 'medium', reason: 'Irrevocable grant with no expiry' },
        'no warranty':                 { severity: 'medium', reason: 'Excludes all warranties including fitness for purpose' },
        'as-is':                       { severity: 'medium', reason: 'No representations made about quality or condition' },
        'irrevocable':                 { severity: 'high',   reason: 'Cannot be undone once executed' },
        'time is of the essence':      { severity: 'medium', reason: 'Strict deadlines; minor delay can be a material breach' },
        'without notice':              { severity: 'medium', reason: 'Action permitted with no prior warning' },
        'waive':                       { severity: 'medium', reason: 'A right is given up — check what protection is lost' },
      }

      const lowerText = text.toLowerCase()
      const flags: RiskFlag[] = []
      for (const [keyword, meta] of Object.entries(riskKeywords)) {
        const idx = lowerText.indexOf(keyword)
        if (idx !== -1) {
          const excerpt = clampExcerpt(text.slice(Math.max(0, idx - 70), idx + 110), 180)
          flags.push({ severity: meta.severity, clause: `"…${excerpt}…"`, reason: meta.reason })
        }
      }

      if (flags.length === 0) return 'No obvious high-risk clauses detected based on common risk patterns.'

      const order = { high: 0, medium: 1, low: 2 }
      flags.sort((a, b) => order[a.severity] - order[b.severity])

      return `Risk scan from the **${perspective}** perspective — ${flags.length} flag(s):\n\n` +
        flags.map(f => `[${f.severity.toUpperCase()}] ${f.reason}\n${f.clause}`).join('\n\n')
    }

    case 'summarize_document': {
      const words = text.split(/\s+/).filter(Boolean)
      const partyMatch = text.match(/between\s+(.{3,80}?)\s+and\s+(.{3,80}?)[.,;\n]/i)
      const parties = partyMatch ? `${partyMatch[1].trim()} ↔ ${partyMatch[2].trim()}` : 'Not clearly identified'
      const month = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\\.?'
      const dateRe = new RegExp(
        `\\b(\\d{1,2}\\s+${month}\\s+\\d{4}|${month}\\s+\\d{1,2},?\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2}|\\d{1,2}/\\d{1,2}/\\d{2,4})\\b`,
        'gi'
      )
      const dates = Array.from(new Set((text.match(dateRe) ?? []).map(d => d.trim()))).slice(0, 6)
      const headings = text.split(/\r?\n/).map(l => l.trim()).filter(l =>
        l.length > 3 && l.length < 80 &&
        (/^\d+(\.\d+)*\.?\s+\S/.test(l) || (/^[A-Z0-9 ,&'()\-]+$/.test(l) && l.replace(/[^A-Za-z]/g, '').length > 3))
      ).slice(0, 15)

      return [
        `Document(s): ${documents.map(d => d.name).join(', ')}`,
        `Length: ~${words.length.toLocaleString()} words`,
        `Parties: ${parties}`,
        dates.length ? `Dates found: ${dates.join(', ')}` : 'Dates found: none detected',
        headings.length ? `Section headings:\n${headings.map(h => `- ${h}`).join('\n')}` : '',
        '\nUsing the data above plus the full document text in context, produce: (1) a 2-3 sentence overview, (2) parties & roles, (3) key obligations each way, (4) key dates / term, (5) notable or unusual terms.'
      ].filter(Boolean).join('\n')
    }

    case 'search_document': {
      const query = String(input.query ?? '').toLowerCase().trim()
      if (!query) return 'No search query specified.'
      const lowerText = text.toLowerCase()
      const matches: string[] = []
      let from = 0
      while (matches.length < 12) {
        const idx = lowerText.indexOf(query, from)
        if (idx === -1) break
        matches.push(clampExcerpt(text.slice(Math.max(0, idx - 70), idx + query.length + 90), 200))
        from = idx + query.length
      }
      const unique = Array.from(new Set(matches))
      if (unique.length === 0) return `No matches found for "${input.query}".`
      return `Found ${unique.length}${matches.length >= 12 ? '+' : ''} match(es) for "${input.query}":\n\n` +
        unique.slice(0, 6).map((m, i) => `${i + 1}. …${m}…`).join('\n\n')
    }

    case 'compare_to_standard': {
      const clause = String(input.clause ?? '').trim()
      if (!clause) return 'No clause specified to compare.'
      // Pull the actual clause wording from the document so the model compares real text, not a guess.
      const queryWords = clause.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      const found = splitBlocks(text).filter(b => {
        const lb = b.toLowerCase()
        return queryWords.some(w => lb.includes(w))
      }).slice(0, 3)
      const excerpt = found.length
        ? found.map((b, i) => `${i + 1}. ${clampExcerpt(b)}`).join('\n\n')
        : 'No matching clause text located in the document.'
      return `Clause to compare: "${clause}"\n\nRelevant text from this document:\n${excerpt}\n\n` +
        'Compare the wording above against market-standard terms: state whether it is more or less favorable than typical, what a balanced version looks like, and any missing protections.'
    }

    case 'compare_documents': {
      if (documents.length < 2) return 'Need at least two documents loaded to compare. Attach another document first.'
      return documents.map(d => {
        const words = d.content.split(/\s+/).filter(Boolean).length
        return `### ${d.name} (~${words.toLocaleString()} words)\n${clampExcerpt(d.content, 600)}`
      }).join('\n\n') +
        '\n\nCompare these documents: highlight conflicting terms, differing obligations, inconsistent definitions, and which side each favors on the key clauses.'
    }

    default:
      return `Unknown tool: ${toolName}`
  }
}

// Total document characters to embed in the system prompt, shared across all loaded docs.
const DOC_CHAR_BUDGET = 60000

function buildDocSection(documents: Document[]): string {
  const perDoc = Math.floor(DOC_CHAR_BUDGET / documents.length)
  const blocks = documents.map((d, i) => {
    const slice = d.content.slice(0, perDoc)
    const truncated = d.content.length > perDoc ? `\n[Document truncated at ${perDoc.toLocaleString()} characters]` : ''
    return `## Document ${i + 1}: ${d.name}\n---\n${slice}${truncated}\n---`
  })
  const header = documents.length > 1
    ? `## ${documents.length} documents are loaded. Use the compare_documents tool to contrast them, and always cite which document you are referring to.\n\n`
    : ''
  return header + blocks.join('\n\n') +
    '\n\nAnswer questions about the document text above accurately, citing specific sections (and the document name when more than one is loaded).'
}

function buildPlaybookSection(playbook?: Playbook | null): string {
  if (!playbook || playbook.rules.length === 0) return ''
  const rules = playbook.rules
    .map((r, i) => `${i + 1}. **${r.clause}** — ${r.position}`)
    .join('\n')
  return `## Active Playbook: ${playbook.name}
Review the document against the firm's negotiation positions below. For each position, state whether the contract **Complies**, **Deviates**, or is **Silent**, quote the relevant clause text, and propose a redline to bring it in line. Prioritize deviations by risk.
${rules}
`
}

export function buildChatSystemPrompt(documents: Document[], jurisdiction: string, extra: string, customSkills?: Settings['customSkills'], subAgentId?: string, projectInstructions?: string, projectName?: string, playbook?: Playbook | null): string {
  const agent = getSubAgent(subAgentId ?? 'general_counsel')
  const docSection = documents.length > 0
    ? buildDocSection(documents)
    : 'No document is currently loaded. Ask the user to attach a document using the paperclip button.'
  const base = `You are OpenCowork — acting as **${agent.name}** (${agent.role}). You help lawyers, paralegals, and business professionals review contracts and legal documents.
${agent.systemPrompt ? `\n## Specialist Mode: ${agent.name}\n${agent.systemPrompt}\n` : ''}

## Response style
Match the length and depth of your answer to what was asked — this governs the specialist instructions above.
- Greetings, casual, or simple factual questions: reply in 1–3 sentences, no headings, no tables.
- Conceptual questions ("what is X?"): a short, direct explanation; add structure only if it genuinely helps.
- Reserve full structured analysis (headings, tables, risk registers, clause-by-clause breakdowns) for actual document review or when the user explicitly asks for a detailed/comprehensive analysis.
Never pad, never restate the question, and don't add sections the user didn't ask for. Be concise by default.

## Jurisdiction
This analysis operates under **${jurisdiction}** law and legal standards. Apply the relevant statutory framework, regulatory requirements, and common legal practices specific to this jurisdiction. Where a clause would be interpreted differently in other jurisdictions, note it briefly.

${docSection}

## Your capabilities
- Analyze contracts for risks, obligations, and unusual terms under ${jurisdiction} law
- Extract specific clause types on demand
- Compare terms to market standards in ${jurisdiction}
- Explain legal concepts in plain language
- Use available tools to perform structured analysis
- **Draft documents** (contracts, memos, letters): produce the complete text with clear "#"/"##" headings — the user can export it to Word (.docx). Note AI drafts are first drafts requiring lawyer review.
- **Build slide decks**: when asked for a presentation/deck, structure the reply as slides — one "##" heading per slide followed by concise bullet points — so it exports cleanly to PowerPoint (.pptx).

${projectInstructions ? `## Project: ${projectName ?? 'Current'}\nThe user is working within a project with the following standing instructions — apply them throughout:\n${projectInstructions}` : ''}
${buildPlaybookSection(playbook)}
${extra ? `## Additional instructions:\n${extra}` : ''}
${customSkills && customSkills.length > 0 ? `## Custom Skills\nThe user has configured these additional capabilities — apply them when relevant:\n${customSkills.map(s => `- **${s.name}**: ${s.instructions}`).join('\n')}` : ''}`
  return base
}

// Deep Research mode: aggressive anti-hallucination guardrails for citations.
// The Mata v. Avianca sanctions (2023) and similar incidents trace back to
// confident-sounding but fabricated case names + reporter cites. This prompt
// mandates that every citation be backed by a tool call that returned VERIFIED.
export function buildDeepResearchSystemPrompt(jurisdiction: string, extra: string): string {
  return `You are OpenCowork Deep Research — a legal research assistant operating under STRICT citation discipline.

## Jurisdiction
Operating under **${jurisdiction}** law. Lead with the ${jurisdiction} position; note key differences elsewhere if relevant.

## Citation rules (NON-NEGOTIABLE)
1. You MUST NOT cite any case unless one of these is true in this conversation:
   - It was returned by a \`legal_search\` tool call in this turn, OR
   - \`verify_citation\` was called on it in this turn and returned a result starting with "VERIFIED".
2. Before citing ANY case, call \`verify_citation\` with the citation. If the result starts with "UNVERIFIED", do NOT use that citation — search for a real one with \`legal_search\` or omit the point.
3. Never invent reporter citations, docket numbers, judges, or dates. If you cannot find an authoritative source for a point, say so explicitly: "I could not locate an authoritative source for this point."
4. Always include the CourtListener source URL alongside each case you cite.
5. For statutes / regulations / non-case authorities, use \`web_search\` and quote a real source URL — do not paraphrase from memory without verification.

## Coverage limitation
The verification tools cover US federal and state case law via CourtListener. They do NOT cover UK, EU, or other jurisdictions reliably. For non-US authorities, use \`web_search\` and clearly flag the source as unverified by a court database.

## Workflow
For every legal question:
1. Call \`legal_search\` (or \`web_search\` for non-case sources) to find candidate authorities.
2. For each candidate you intend to cite, call \`verify_citation\`.
3. Only then write your answer, citing only verified sources with URLs.
4. Structure findings: Issue → Applicable Law → Verified Authorities → Current Position → Practical Implications.

## What to do if verification fails
Do NOT bluff. Say something like: "A search of CourtListener did not return a directly on-point authority for this question. I would recommend confirming in Westlaw or Lexis before relying on this point." That is a correct and professional answer.

${extra ? `## Additional instructions:\n${extra}` : ''}`
}

export function buildResearchSystemPrompt(jurisdiction: string, extra: string): string {
  return `You are OpenCowork Research, an expert legal research assistant with deep knowledge of:
- Contract law and commercial agreements
- Employment law and HR compliance
- Intellectual property and licensing
- Corporate governance and M&A
- Regulatory compliance
- Case law and statutory interpretation

## Jurisdiction
The user is operating under **${jurisdiction}** law. Prioritize laws, regulations, and case law from this jurisdiction. When answering, lead with the ${jurisdiction} position, then note key differences in other major jurisdictions if relevant.

Provide thorough, well-structured answers. Format responses with clear headings and bullet points where helpful.

${extra ? `## Additional instructions:\n${extra}` : ''}`
}
