"use client";

export type ActiveTab = "analyze" | "ranking" | "qa";

interface NavbarProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  totalQuestions: number;
  onOpenAskModal: (targetBloggerId?: number | null) => void;
}

export function Navbar({
  activeTab,
  onChangeTab,
  totalQuestions,
  onOpenAskModal,
}: NavbarProps) {
  const navItems: Array<{ id: ActiveTab; label: string; count?: number }> = [
    { id: "analyze", label: "진단" },
    { id: "ranking", label: "랭킹" },
    { id: "qa", label: "질문", count: totalQuestions },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <button
          type="button"
          onClick={() => onChangeTab("analyze")}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          <span className="text-[17px] font-bold tracking-tight text-[#1D1D1F]">
            BLNK
          </span>
          <span className="text-xs font-medium text-[#86868B]">블랭크</span>
        </button>

        {/* Apple-style Segmented Control */}
        <nav
          aria-label="주요 메뉴"
          className="flex items-center rounded-full bg-[#F5F5F7] p-1"
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-white text-[#1D1D1F] shadow-2xs"
                    : "text-[#86868B] hover:text-[#1D1D1F]"
                }`}
              >
                <span>{item.label}</span>
                {typeof item.count === "number" && item.count > 0 && (
                  <span className="font-num text-[11px] text-[#86868B]">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Minimal Actions */}
        <div className="flex items-center gap-2">
          <a
            href="/blnk-github-files.zip"
            download="blnk-github-files.zip"
            className="inline-flex items-center rounded-full border border-black/12 px-3.5 py-1.5 text-[12px] font-medium text-[#0071E3] transition-colors hover:bg-[#F5F5F7]"
          >
            파일 받기 (.zip)
          </a>
          <button
            type="button"
            onClick={() => onOpenAskModal(null)}
            className="rounded-full bg-[#1D1D1F] px-4 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 cursor-pointer"
          >
            질문하기
          </button>
        </div>
      </div>
    </header>
  );
}
