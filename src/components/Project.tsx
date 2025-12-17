import { onMount, createSignal, Show, Switch, Match, For } from "solid-js";
import type { Component } from "solid-js";
import { OhVueIcons, OhMyCV } from "./icons";
import type { ProjectItem } from "@types";

export const Project: Component<{ project: ProjectItem }> = (props) => {
  /* eslint-disable-next-line solid/reactivity */
  const api = "https://api.github.com/repos/" + props.project.repo;
  const [star, setStar] = createSignal<string>();

  const getRepoStars = async () => {
    const data = await fetch(api).then((res) => res.json());
    return data.stargazers_count;
  };

  onMount(async () => props.project.repo && setStar(await getRepoStars()));

  const isGithubLink = props.project.link?.includes("github.com/") ?? false;
  const liveHref = props.project.link && !isGithubLink ? props.project.link : undefined;
  const repoHref = props.project.repo
    ? `https://github.com/${props.project.repo}`
    : isGithubLink
      ? props.project.link
      : undefined;

  return (
    <article class="project-card relative hstack gap-x-5 p-4 !no-underline !text-fg">
      <div flex-auto h-full>
        <div class="hstack flex-wrap">
          <div whitespace-nowrap mr-3>
            {props.project.name}
          </div>
          <div hstack gap-x-2>
            <For each={props.project.tech}>
              {(icon) => <span class={`tech-icon ${icon}`} />}
            </For>

            <Show when={star()}>
              <span hstack gap-x-1>
                <span i-noto-v1:star text-xs />
                <span class="text-sm mt-0.5">{star()}</span>
              </span>
            </Show>
          </div>
        </div>
        <div mt-1 text="sm fg-light" innerHTML={props.project.desc} />
        <div class="project-links" mt-3>
          <Show when={liveHref}>
            <a class="project-link-btn" href={liveHref} target="_blank" rel="noopener noreferrer">
              Live
            </a>
          </Show>
          <Show when={repoHref}>
            <a class="project-link-btn" href={repoHref} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </Show>
        </div>
      </div>

      <div pt-2 text="3xl fg-light">
        <Switch fallback={<div class={props.project.icon || "i-carbon-unknown"} />}>
          <Match when={props.project.icon === "oh-vue-icons"}>
            <OhVueIcons />
          </Match>
          <Match when={props.project.icon === "oh-my-cv"}>
            <OhMyCV />
          </Match>
        </Switch>
      </div>
    </article>
  );
};

export default Project;
