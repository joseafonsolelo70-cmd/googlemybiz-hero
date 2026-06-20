import { cn } from "@/lib/utils";
import { oportunidadeFromScore, OPORTUNIDADE_LABEL } from "@/lib/seo";

const STYLES: Record<string, string> = {
  alta: "bg-success/15 text-success border-success/30",
  media: "bg-warning/15 text-warning border-warning/40",
  baixa: "bg-muted text-muted-foreground border-border",
};

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const op = oportunidadeFromScore(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STYLES[op],
        className,
      )}
    >
      <span className="tabular-nums">SEO {score}</span>
      <span className="opacity-70">·</span>
      <span>{OPORTUNIDADE_LABEL[op]}</span>
    </span>
  );
}
