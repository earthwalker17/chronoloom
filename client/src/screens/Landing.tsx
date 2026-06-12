import type { EngineId } from "@shared/constants";
import type { ProviderInfo } from "@shared/types";

interface Props {
  providers: ProviderInfo[];
  selected: EngineId;
  onSelectProvider: (id: EngineId) => void;
  canResume: boolean;
  onEnter: () => void;
  onResume: () => void;
}

export function Landing({ providers, selected, onSelectProvider, canResume, onEnter, onResume }: Props) {
  return (
    <div className="screen">
      <div style={{ display: "flex", gap: 28, alignItems: "flex-start" }} className="fade-in">
        <h1 className="title-vertical" style={{ fontSize: 64, minHeight: 300 }}>
          长安上元
        </h1>
        <p className="title-vertical" style={{ fontSize: 17, paddingTop: 18, color: "var(--paper-deep)" }}>
          时织 · 活成另一个人
        </p>
      </div>
      <p className="fade-in" style={{ color: "var(--paper-deep)", fontSize: 14.5, letterSpacing: "0.15em", textShadow: "0 1px 6px #000" }}>
        唐 · 天宝三载 · 东市灯节七日 —— 你的每一个选择，这座城都会记得。
      </p>
      <div className="fade-in" style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <button className="btn-cinnabar" onClick={onEnter}>
          入梦长安
        </button>
        {canResume && (
          <button className="btn-ghost" onClick={onResume}>
            续前缘
          </button>
        )}
      </div>
      <div className="provider-row fade-in">
        <span className="provider-label">执笔者</span>
        {providers.map((p) => (
          <button
            key={p.id}
            className={`provider-chip${selected === p.id ? " selected" : ""}${p.available ? "" : " unavailable"}`}
            disabled={!p.available}
            title={p.available ? (p.model ?? undefined) : "未检测到密钥"}
            onClick={() => p.available && onSelectProvider(p.id)}
          >
            {p.labelZh}
            {p.id === "claude" && p.available && <span className="provider-tag">荐</span>}
            {!p.available && <span className="provider-tag dim">未配置</span>}
          </button>
        ))}
      </div>
      {selected === "scripted" && <span className="chip">演示模式 · 离线推演</span>}
    </div>
  );
}
