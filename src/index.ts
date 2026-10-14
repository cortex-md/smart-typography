import { type ContextMenuActionContext, definePlugin, type PluginManifest } from "@cortex.md/api"
import manifest from "../manifest.json"
import { applyTypography, type RuleGroup, typographyRules } from "./rules"

const groups: readonly RuleGroup[] = ["dashes", "ellipsis", "arrows", "symbols"]

function targetPath(payload: unknown, activePath: string | null) {
	const context = payload as ContextMenuActionContext | undefined
	if (context?.location === "file" || context?.location === "editor") {
		return context.filePath ?? activePath
	}
	return activePath
}

export default definePlugin({
	manifest: manifest as PluginManifest,
	settings: {
		dashes: {
			type: "boolean",
			label: "Dashes",
			description: "Show -- between words as an em dash (—).",
			default: true,
		},
		ellipsis: {
			type: "boolean",
			label: "Ellipsis",
			description: "Show ... as an ellipsis (…).",
			default: true,
		},
		arrows: {
			type: "boolean",
			label: "Arrows",
			description: "Show ->, <-, <-> and => as →, ←, ↔ and ⇒.",
			default: true,
		},
		symbols: {
			type: "boolean",
			label: "Symbols",
			description: "Show (c), (r) and (tm) as ©, ® and ™.",
			default: true,
		},
	},
	contributes: {
		markdown: {
			inline: typographyRules.map((rule) => ({
				id: rule.id,
				pattern: rule.pattern,
				flags: rule.flags,
				when: rule.group,
				replacement: {
					type: "text" as const,
					content: (match: RegExpExecArray) => rule.replace(match[0]),
				},
			})),
		},
		commands: [
			{
				id: "apply-to-note",
				label: "Smart Typography: Apply to this note",
				icon: "type",
				run: async (ctx, payload) => {
					const path = targetPath(payload, ctx.editor.getActiveFilePath())
					if (!path?.endsWith(".md")) {
						ctx.ui.showNotice("Open a Markdown note first.")
						return
					}
					const settings = ctx.settings.getAll()
					const enabled = new Set(groups.filter((group) => settings[group]))
					if (enabled.size === 0) {
						ctx.ui.showNotice("Every Smart Typography rule is turned off.")
						return
					}
					const result = applyTypography(await ctx.vault.readFile(path), enabled)
					if (result.changedLines === 0) {
						ctx.ui.showNotice("Nothing to replace in this note.")
						return
					}
					await ctx.vault.writeFile(path, result.markdown)
					ctx.ui.showNotice(
						`Applied smart typography to ${result.changedLines} ${result.changedLines === 1 ? "line" : "lines"}.`,
					)
				},
			},
		],
		contextMenuItems: [
			{
				id: "apply-to-file",
				label: "Apply smart typography",
				icon: "type",
				location: "file",
				command: "apply-to-note",
			},
		],
	},
})
