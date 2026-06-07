import type { AgentTool, Document, RiskFlag, Settings, SubAgent } from '../types'

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
  }
]

export function getActiveTools(settings: Settings): AgentTool[] {
  const enabled = new Set(
    settings.builtInSkills.filter(s => s.enabled).map(s => s.id)
  )
  const tools = LEGAL_TOOLS.filter(t => enabled.has(t.function.name) || t.function.name === 'web_search')
  // always include web_search for the web_researcher agent
  return tools
}

export function executeAgentTool(
  toolName: string,
  input: Record<string, unknown>,
  document: Document | null
): string | Promise<string> {
  if (!document) return 'No document is currently loaded.'

  const text = document.content

  switch (toolName) {
    case 'extract_clauses': {
      const clauseType = (input.clause_type as string).toLowerCase()
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20)
      const relevant = sentences.filter(s =>
        s.toLowerCase().includes(clauseType) ||
        clauseType.split(' ').every(word => s.toLowerCase().includes(word))
      )
      if (relevant.length === 0) return `No clauses explicitly mentioning "${input.clause_type}" found in the document.`
      return `Found ${relevant.length} relevant clause(s) for "${input.clause_type}":\n\n` +
        relevant.slice(0, 8).map((s, i) => `${i + 1}. ${s.trim()}`).join('\n\n')
    }

    case 'identify_risks': {
      const riskKeywords: Record<string, { severity: RiskFlag['severity']; reason: string }> = {
        'unlimited liability': { severity: 'high', reason: 'Exposes party to uncapped financial risk' },
        'indemnify and hold harmless': { severity: 'high', reason: 'Broad indemnification obligation' },
        'sole discretion': { severity: 'medium', reason: 'Gives one party unchecked power to decide' },
        'automatic renewal': { severity: 'medium', reason: 'Contract auto-renews without explicit consent' },
        'unilateral': { severity: 'medium', reason: 'One-sided modification rights' },
        'liquidated damages': { severity: 'medium', reason: 'Pre-determined penalties may be disproportionate' },
        'non-compete': { severity: 'high', reason: 'May restrict future business activities' },
        'perpetual license': { severity: 'medium', reason: 'Irrevocable grant with no expiry' },
        'no warranty': { severity: 'medium', reason: 'Excludes all warranties including fitness for purpose' },
        'as-is': { severity: 'medium', reason: 'No representations made about quality or condition' },
        'irrevocable': { severity: 'high', reason: 'Cannot be undone once executed' }
      }

      const flags: RiskFlag[] = []
      for (const [keyword, meta] of Object.entries(riskKeywords)) {
        if (text.toLowerCase().includes(keyword)) {
          const idx = text.toLowerCase().indexOf(keyword)
          const excerpt = text.slice(Math.max(0, idx - 60), idx + 100).trim()
          flags.push({ severity: meta.severity, clause: `"...${excerpt}..."`, reason: meta.reason })
        }
      }

      if (flags.length === 0) return 'No obvious high-risk clauses detected based on common risk patterns.'

      const sorted = flags.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 }
        return order[a.severity] - order[b.severity]
      })

      return sorted.map(f =>
        `[${f.severity.toUpperCase()}] ${f.reason}\n${f.clause}`
      ).join('\n\n')
    }

    case 'summarize_document': {
      const wordCount = text.split(/\s+/).length
      const firstParagraph = text.slice(0, 800).trim()
      return `Document: ${document.name}\nWord count: ~${wordCount}\n\nOpening:\n${firstParagraph}\n\n[The AI will generate a full structured summary based on the document content above]`
    }

    case 'search_document': {
      const query = (input.query as string).toLowerCase()
      const lines = text.split('\n').filter(l => l.trim().length > 0)
      const matches = lines.filter(l => l.toLowerCase().includes(query))
      if (matches.length === 0) return `No matches found for "${input.query}".`
      return `Found ${matches.length} match(es) for "${input.query}":\n\n` +
        matches.slice(0, 6).map((m, i) => `${i + 1}. ${m.trim()}`).join('\n\n')
    }

    case 'compare_to_standard': {
      return `Clause analysis for: "${input.clause}"\n\n[The AI will compare this clause against market standard terms based on its training knowledge of commercial contracts]`
    }

    case 'web_search': {
      const query = input.query as string
      if (!window.electronAPI?.webSearch) return 'Web search is not available in this environment.'
      return window.electronAPI.webSearch(query)
    }

    default:
      return `Unknown tool: ${toolName}`
  }
}

export function buildChatSystemPrompt(document: Document | null, jurisdiction: string, extra: string, customSkills?: Settings['customSkills'], subAgentId?: string): string {
  const agent = getSubAgent(subAgentId ?? 'general_counsel')
  const base = `You are OpenCowork — acting as **${agent.name}** (${agent.role}). You help lawyers, paralegals, and business professionals review contracts and legal documents.
${agent.systemPrompt ? `\n## Specialist Mode: ${agent.name}\n${agent.systemPrompt}\n` : ''}

## Jurisdiction
This analysis operates under **${jurisdiction}** law and legal standards. Apply the relevant statutory framework, regulatory requirements, and common legal practices specific to this jurisdiction. Where a clause would be interpreted differently in other jurisdictions, note it briefly.

${document ? `## Current Document: ${document.name}

FULL DOCUMENT TEXT:
---
${document.content.slice(0, 60000)}
${document.content.length > 60000 ? '\n[Document truncated at 60,000 characters]' : ''}
---

You have access to the full document above. Answer questions about it accurately and cite specific sections when possible.` : 'No document is currently loaded. Ask the user to open a document using the Upload button.'}

## Your capabilities
- Analyze contracts for risks, obligations, and unusual terms under ${jurisdiction} law
- Extract specific clause types on demand
- Compare terms to market standards in ${jurisdiction}
- Explain legal concepts in plain language
- Use available tools to perform structured analysis

${extra ? `## Additional instructions:\n${extra}` : ''}
${customSkills && customSkills.length > 0 ? `## Custom Skills\nThe user has configured these additional capabilities — apply them when relevant:\n${customSkills.map(s => `- **${s.name}**: ${s.instructions}`).join('\n')}` : ''}`
  return base
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
