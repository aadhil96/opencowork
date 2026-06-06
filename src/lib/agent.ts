import type { AgentTool, Document, RiskFlag, Settings } from '../types'

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
  }
]

export function getActiveTools(settings: Settings): AgentTool[] {
  const enabled = new Set(
    settings.builtInSkills.filter(s => s.enabled).map(s => s.id)
  )
  return LEGAL_TOOLS.filter(t => enabled.has(t.function.name))
}

export function executeAgentTool(
  toolName: string,
  input: Record<string, unknown>,
  document: Document | null
): string {
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

    default:
      return `Unknown tool: ${toolName}`
  }
}

export function buildChatSystemPrompt(document: Document | null, jurisdiction: string, extra: string, customSkills?: Settings['customSkills']): string {
  const base = `You are OpenCowork, an expert AI legal analyst. You help lawyers, paralegals, and business professionals review contracts and legal documents.

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
