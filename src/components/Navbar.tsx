import { Show, type Component } from "solid-js";
import ToggleDark from "@components/ToggleDark";
import ToggleToc from "@components/ToggleToc";

export const Navbar: Component<{
  activePage?: string;
  hasToc?: boolean;
}> = (props) => {
  return (
    <header
      class="z-50 fixed left-1/2 top-4 -translate-x-1/2 w-auto min-w-fit max-w-xl h-11 flex items-center justify-center bg-bg/95 dark:bg-bg-dark/95 border border-white/10 dark:border-black/20 shadow-md rounded-lg font-ui px-2 md:px-4"
      style="transition: box-shadow 0.2s, background 0.2s;"
    >
      {/* Left: Logo */}
      <div class="flex items-center min-w-0">
        <a class="font-semibold text-fg-light hover:text-fg-dark text-base tracking-tight flex items-center gap-1" href="/">
          hi@mxnish
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
        <a
          class={`nav-btn${props.activePage === "search" ? " nav-btn-active" : ""}`}
          href="/search"
        >
          <span i-uil:search />
        </a>
      </nav>

      {/* Right: Toggles */}
      <div class="flex items-center min-w-0 gap-x-1 ml-1">
        <ToggleDark />
        <Show when={props.hasToc}>
          <ToggleToc />
        </Show>
      </div>

      <style>{`
        .nav-btn {
          color: var(--fg-light);
          padding: 0.15rem 0.7rem;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
          font-weight: 500;
        }
        .nav-btn:hover {
          background: #f3f4f6;
          color: var(--fg-dark);
        }
        .nav-btn-active {
          background: #e5e7eb;
          color: var(--fg-dark);
          border-radius: 6px;
        }
        @media (prefers-color-scheme: dark) {
          .nav-btn:hover {
            background: #23272e;
            color: #fff;
          }
          .nav-btn-active {
            background: #23272e;
            color: #fff;
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
      `}</style>
    </header>
  );
};

export default Navbar;
