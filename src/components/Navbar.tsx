import { Show, type Component } from "solid-js";
import ToggleToc from "@components/ToggleToc";

export const Navbar: Component<{
  activePage?: string;
  hasToc?: boolean;
}> = (props) => {
  return (
    <header
      class="z-50 fixed left-1/2 top-4 -translate-x-1/2 w-auto min-w-fit max-w-xl h-11 flex items-center justify-center rounded-lg font-ui px-2 md:px-4"
      style={{ transition: "box-shadow 0.2s, background 0.2s" }}
    >
      {/* Left: Logo */}
      <div class="flex items-center min-w-0">
        <a
          class="font-semibold text-fg-light hover:text-fg-dark text-base tracking-tight flex items-center gap-1"
          href="/"
        >
          hi@keir
          <span class="blink">_</span>
        </a>
      </div>

      {/* Center: Nav Links */}
      <nav class="flex items-center gap-x-2 mx-1 text-sm font-medium">
        <a
          class={`nav-btn${props.activePage === "projects" ? " nav-btn-active" : ""}`}
          href="/projects"
        >
          Builds
        </a>
        <a
          class={`nav-btn${props.activePage === "posts" ? " nav-btn-active" : ""}`}
          href="/posts"
        >
          Articles
        </a>
        <a
          class={`nav-btn${props.activePage === "now" ? " nav-btn-active" : ""}`}
          href="/now"
        >
          Log
        </a>
        <a
          class={`nav-btn${props.activePage === "journal" ? " nav-btn-active" : ""}`}
          href="/journal"
          title="Journal"
        >
          Journal
        </a>
      </nav>

      {/* Right: Toggles */}
      <div class="flex items-center min-w-0 gap-x-1 ml-1">
        <Show when={props.hasToc}>
          <ToggleToc />
        </Show>
      </div>

      <style>{`
        header {
          background: transparent;
          border: none;
          box-shadow: none;
          backdrop-filter: none;
          max-width: min(1100px, 92vw);
        }
        nav {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .nav-btn {
          color: var(--fg-light);
          padding: 0.15rem 0.7rem;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          font-weight: 500;
          font-size: clamp(0.9rem, 1vw + 0.82rem, 1rem);
        }
        .nav-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #e8ecff;
        }
        .nav-btn-active {
          background: rgba(255, 255, 255, 0.12);
          color: #ffffff;
          border-radius: 6px;
        }
        @media (prefers-color-scheme: dark) {
          .nav-btn:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #e8ecff;
          }
          .nav-btn-active {
            background: rgba(255, 255, 255, 0.12);
            color: #ffffff;
            border-radius: 6px;
          }
        }
        .blink {
          animation: blink 1.1s steps(2, start) infinite;
        }
        @keyframes blink {
          to {
            visibility: hidden;
          }
        }

        @media (max-width: 640px) {
          header {
            width: calc(100% - 1rem);
            left: 50%;
            transform: translateX(-50%);
            padding-left: calc(0.4rem + env(safe-area-inset-left, 0px));
            padding-right: calc(0.4rem + env(safe-area-inset-right, 0px));
          }
          nav {
            gap: 0.35rem;
          }
          .nav-btn {
            padding: 0.15rem 0.55rem;
            font-size: 0.92rem;
          }
        }

        @media (min-width: 1280px) {
          header {
            max-width: 1100px;
          }
          nav {
            gap: 0.75rem;
          }
          .nav-btn {
            font-size: 1rem;
            padding: 0.18rem 0.8rem;
          }
        }
      `}</style>
    </header>
  );
};

export default Navbar;
