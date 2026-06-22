import type { ResumeCompareResponse } from '@/types';

export function formatResumeCompareMarkdown(data: ResumeCompareResponse): string {
  const score = Math.round(data.overall_score * 100);
  const lines: string[] = [
    `## Portfolio match: **${score}%**`,
    '',
    data.summary,
  ];

  if (data.extracted_skills?.length) {
    lines.push('', '### Skills detected', data.extracted_skills.map((s) => `- ${s}`).join('\n'));
  }

  if (data.matches?.length) {
    lines.push('', '### Project alignment');
    for (const match of data.matches) {
      const pct = Math.round(match.relevancy_score * 100);
      lines.push('', `**${match.project_title}** — ${pct}% match`, '', match.explanation);
      if (match.matching_skills?.length) {
        lines.push('', `*Overlap:* ${match.matching_skills.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}
