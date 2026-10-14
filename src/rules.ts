export type RuleGroup = "dashes" | "ellipsis" | "arrows" | "symbols"

export interface TypographyRule {
	id: string
	group: RuleGroup
	pattern: string
	flags?: string
	replace: (match: string) => string
}

const arrows: Record<string, string> = {
	"<->": "↔",
	"<-": "←",
	"->": "→",
	"=>": "⇒",
}

const symbols: Record<string, string> = {
	"(c)": "©",
	"(r)": "®",
	"(tm)": "™",
}

export const typographyRules: readonly TypographyRule[] = [
	{
		id: "em-dash",
		group: "dashes",
		pattern: "(?<=[\\p{L}\\p{N} ])--(?=[\\p{L}\\p{N} ])",
		flags: "u",
		replace: () => "—",
	},
	{
		id: "ellipsis",
		group: "ellipsis",
		pattern: "(?<!\\.)\\.\\.\\.(?!\\.)",
		replace: () => "…",
	},
	{
		id: "arrows",
		group: "arrows",
		pattern: "<->|(?<![<!-])<-(?!-)|(?<![-<])->|(?<![=<>!])=>",
		replace: (match) => arrows[match] ?? match,
	},
	{
		id: "symbols",
		group: "symbols",
		pattern: "\\((?:c|r|tm)\\)",
		flags: "i",
		replace: (match) => symbols[match.toLowerCase()] ?? match,
	},
]

const fence = /^\s{0,3}(`{3,}|~{3,})/
const inlineCode = /(`+)[\s\S]*?\1/g

function transformText(text: string, rules: readonly TypographyRule[]) {
	let output = text
	for (const rule of rules) {
		const flags = new Set(`${rule.flags ?? ""}g`)
		output = output.replace(new RegExp(rule.pattern, [...flags].join("")), rule.replace)
	}
	return output
}

function transformLine(line: string, rules: readonly TypographyRule[]) {
	let result = ""
	let last = 0
	for (const match of line.matchAll(inlineCode)) {
		result += transformText(line.slice(last, match.index), rules) + match[0]
		last = match.index + match[0].length
	}
	return result + transformText(line.slice(last), rules)
}

export function applyTypography(markdown: string, groups: ReadonlySet<RuleGroup>) {
	const rules = typographyRules.filter((rule) => groups.has(rule.group))
	const lines = markdown.split("\n")
	let openFence: string | null = null
	let inFrontmatter = lines[0]?.trim() === "---"
	let changes = 0

	const output = lines.map((line, index) => {
		if (inFrontmatter) {
			if (index > 0 && line.trim() === "---") inFrontmatter = false
			return line
		}
		const fenceMatch = line.match(fence)
		if (fenceMatch?.[1]) {
			const marker = fenceMatch[1]
			if (!openFence) openFence = marker
			else if (marker[0] === openFence[0] && marker.length >= openFence.length) openFence = null
			return line
		}
		if (openFence || /^( {4}|\t)(?!\s*(?:[-*+]|\d+[.)])\s)/.test(line)) return line
		const next = transformLine(line, rules)
		if (next !== line) changes += 1
		return next
	})

	return { markdown: output.join("\n"), changedLines: changes }
}
