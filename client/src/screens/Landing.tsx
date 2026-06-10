interface Props {
  engine: "claude" | "scripted";
  canResume: boolean;
  onEnter: () => void;
  onResume: () => void;
}

export function Landing({ engine, canResume, onEnter, onResume }: Props) {
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
      {engine === "scripted" && <span className="chip">演示模式 · 离线推演</span>}
    </div>
  );
}
