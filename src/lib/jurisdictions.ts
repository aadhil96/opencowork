// Jurisdictions the user can pick — shared between the inline chat-input
// picker and the Settings modal so they never drift apart.
export interface JurisdictionGroup {
  group: string
  options: string[]
}

export const JURISDICTIONS: JurisdictionGroup[] = [
  { group: 'General',              options: ['General / International'] },
  { group: 'Americas',             options: ['United States (Federal)', 'United States — California', 'United States — New York', 'United States — Texas', 'Canada (Federal)', 'Canada — Ontario', 'Canada — Quebec', 'Brazil', 'Mexico', 'Argentina', 'Colombia'] },
  { group: 'Europe',               options: ['United Kingdom (England & Wales)', 'United Kingdom — Scotland', 'European Union', 'Germany', 'France', 'Netherlands', 'Sweden', 'Switzerland', 'Spain', 'Italy', 'Ireland', 'Poland'] },
  { group: 'Asia Pacific',         options: ['India', 'Singapore', 'Australia', 'New Zealand', 'Hong Kong', 'Japan', 'China (PRC)', 'South Korea', 'Malaysia', 'Indonesia', 'Thailand', 'Vietnam'] },
  { group: 'Middle East & Africa', options: ['UAE (Dubai / DIFC)', 'UAE (Abu Dhabi)', 'Saudi Arabia', 'Qatar', 'South Africa', 'Nigeria', 'Kenya', 'Egypt'] },
]

// Short labels for chips/pills — e.g. "UK (E&W)" instead of the full name.
export function shortJurisdictionLabel(j: string): string {
  if (!j) return 'General'
  return j
    .replace('General / International', 'General')
    .replace('United States — ', 'US — ')
    .replace('United States ', 'US ')
    .replace('United Kingdom — ', 'UK — ')
    .replace('United Kingdom (England & Wales)', 'UK (E&W)')
    .replace('Canada — ', 'CA — ')
    .replace('Canada ', 'CA ')
    .replace('European Union', 'EU')
    .replace('UAE (Dubai / DIFC)', 'UAE — DIFC')
    .replace('UAE (Abu Dhabi)', 'UAE — AD')
    .replace('China (PRC)', 'China')
}
