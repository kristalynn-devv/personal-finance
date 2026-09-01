export function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5 text-sm leading-relaxed break-words">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />
        if (line.startsWith("##")) return <h3 key={i} className="font-semibold text-base mt-3">{line.replace(/^#+\s*/, "")}</h3>
        if (line.startsWith("#")) return <h2 key={i} className="font-bold text-lg mt-4">{line.replace(/^#+\s*/, "")}</h2>
        if (line.match(/^\d+\./)) return <p key={i} className="font-medium mt-2">{line}</p>
        if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="pl-3 text-muted-foreground">{line}</p>
        if (line.match(/^[📊💡⚠️✅🏖️🧾📈🎯🏦💰🔄⚡👤💳]/)) return <p key={i} className="font-medium mt-3">{line}</p>
        return <p key={i} className="text-muted-foreground">{line}</p>
      })}
    </div>
  )
}
